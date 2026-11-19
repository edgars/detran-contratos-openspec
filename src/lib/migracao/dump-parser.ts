import { createReadStream } from "node:fs";
import { basename } from "node:path";

/**
 * Parser do dump do `mysqldump` (025-migracao-legado, design.md D1). Não é um parser SQL geral:
 * reconhece só o que o `mysqldump` escreve — `USE`/`CREATE DATABASE` (banco corrente), `CREATE TABLE`
 * (colunas na ordem, tipo, `PRIMARY KEY`) e `INSERT INTO … VALUES (…),(…);` (inclusive com lista de
 * colunas) — e ignora comentários, `SET`, `LOCK TABLES`, `DROP`, `ALTER … KEYS`.
 *
 * Todo valor sai como TEXTO ou `null`, nunca como `number`: dinheiro do legado (FLOAT) não passa por
 * ponto flutuante (D5). O arquivo é lido em stream; as instruções são separadas por `;` fora de aspas.
 */

export type Valor = string | null;

export type ColunaDump = { nome: string; tipo: string };

export type TabelaDump = {
  banco: string;
  nome: string;
  colunas: ColunaDump[];
  chavePrimaria: string[];
  /** Linhas na ordem de `colunas`. Colunas descartadas (ex.: `users.password`) vêm sempre `null`. */
  linhas: Valor[][];
  arquivo: string;
};

export type Dump = { tabelas: Map<string, TabelaDump>; arquivos: string[] };

export type Encoding = "utf8" | "latin1";

/** Erro que aborta a carga sem gravar nada (código de saída 1). */
export class DumpError extends Error {}

export const MSG_NAO_E_DUMP = "não parece um dump do mysqldump";

export type OpcoesParser = {
  encoding?: Encoding;
  /**
   * Colunas cujo valor é descartado na leitura (`banco.tabela.coluna`): o valor nunca chega à memória
   * do relatório, ao log ou ao banco (D7: a senha do legado).
   */
  descartar?: ReadonlySet<string>;
  /** Bancos conhecidos por nome de tabela, para arquivo sem `USE` e com nome que não indica o banco. */
  bancoDaTabela?: (tabela: string) => string[];
};

export const chaveTabela = (banco: string, tabela: string) => `${banco}.${tabela}`;

/** Banco pelo nome do arquivo (`contratos*.sql` → contratos, `global*.sql` → global). */
export function bancoPeloArquivo(arquivo: string): string | null {
  const nome = basename(arquivo).toLowerCase();
  if (nome.startsWith("contratos")) return "contratos";
  if (nome.startsWith("global")) return "global";
  return null;
}

// ---------------------------------------------------------------------------------------------
// Divisão em instruções (stream)
// ---------------------------------------------------------------------------------------------

type Estado = "normal" | "aspaSimples" | "aspaDupla" | "crase" | "comentarioLinha" | "comentarioBloco";

/** Separa o texto em instruções terminadas por `;` fora de aspas e comentários; descarta comentários. */
class Divisor {
  private atual = "";
  private estado: Estado = "normal";
  private escape = false;
  private anterior = "";
  readonly prontas: string[] = [];

  push(texto: string) {
    let buf = this.atual;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      switch (this.estado) {
        case "normal":
          if (c === "'") this.estado = "aspaSimples";
          else if (c === '"') this.estado = "aspaDupla";
          else if (c === "`") this.estado = "crase";
          else if (c === "-" && this.anterior === "-" && buf.endsWith("-") && /(^|\s)$/.test(buf.slice(0, -1))) {
            buf = buf.slice(0, -1);
            this.estado = "comentarioLinha";
            this.anterior = "";
            continue;
          } else if (c === "#" && /(^|\s)$/.test(buf)) {
            this.estado = "comentarioLinha";
            continue;
          } else if (c === "*" && this.anterior === "/" && buf.endsWith("/")) {
            buf = buf.slice(0, -1);
            this.estado = "comentarioBloco";
            this.anterior = "";
            continue;
          } else if (c === ";") {
            if (buf.trim()) this.prontas.push(buf.trim());
            buf = "";
            this.anterior = "";
            continue;
          }
          buf += c;
          break;
        case "aspaSimples":
        case "aspaDupla": {
          buf += c;
          const fecha = this.estado === "aspaSimples" ? "'" : '"';
          if (this.escape) this.escape = false;
          else if (c === "\\") this.escape = true;
          else if (c === fecha) this.estado = "normal"; // '' vira duas aspas seguidas: reabre na próxima
          break;
        }
        case "crase":
          buf += c;
          if (c === "`") this.estado = "normal";
          break;
        case "comentarioLinha":
          if (c === "\n") {
            this.estado = "normal";
            buf += "\n";
          }
          break;
        case "comentarioBloco":
          if (c === "/" && this.anterior === "*") {
            this.estado = "normal";
            buf += " ";
            this.anterior = "";
            continue;
          }
          break;
      }
      this.anterior = c;
    }
    this.atual = buf;
  }

  fim() {
    if (this.atual.trim()) this.prontas.push(this.atual.trim());
    this.atual = "";
  }
}

// ---------------------------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------------------------

const ESCAPES: Record<string, string> = { "0": "\0", b: "\b", n: "\n", r: "\r", t: "\t", Z: "\x1a", "\\": "\\", "'": "'", '"': '"' };

/** Lê uma string entre aspas a partir de `i` (na aspa de abertura); devolve o texto e a posição depois da aspa final. */
function lerString(s: string, i: number): [string, number] {
  const aspa = s[i];
  let out = "";
  let j = i + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === "\\") {
      const n = s[j + 1];
      // \% e \_ mantêm a barra (regra do MySQL); outro escape desconhecido vira o próprio caractere.
      out += n === "%" || n === "_" ? `\\${n}` : (ESCAPES[n] ?? n);
      j += 2;
      continue;
    }
    if (c === aspa) {
      if (s[j + 1] === aspa) {
        out += aspa;
        j += 2;
        continue;
      }
      return [out, j + 1];
    }
    out += c;
    j++;
  }
  throw new DumpError("string sem aspa de fechamento no INSERT");
}

/** Hex (`0x…`/`X'…'`) → texto no encoding do dump. */
function hexParaTexto(hex: string, decodificar: (b: Buffer) => string): string {
  if (hex.length % 2) hex = `0${hex}`;
  return decodificar(Buffer.from(hex, "hex"));
}

/** `b'0101'` → inteiro em texto, sem passar por number (BigInt). */
const bitParaTexto = (bits: string) => (bits ? BigInt(`0b${bits}`).toString() : "0");

/** Lê as tuplas de `VALUES (…),(…)` a partir de `i`. */
function lerTuplas(s: string, i: number, decodificar: (b: Buffer) => string): Valor[][] {
  const linhas: Valor[][] = [];
  const pular = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };
  pular();
  while (i < s.length) {
    if (s[i] !== "(") throw new DumpError(`INSERT malformado perto de "${s.slice(i, i + 20)}"`);
    i++;
    const linha: Valor[] = [];
    for (;;) {
      pular();
      const c = s[i];
      if (c === "'" || c === '"') {
        const [txt, j] = lerString(s, i);
        linha.push(txt);
        i = j;
      } else if (c === "_" && /^_[a-z0-9]+\s*'/i.test(s.slice(i, i + 20))) {
        // Introdutor de charset (`_binary '…'`): ignora o prefixo.
        i = s.indexOf("'", i);
        continue;
      } else if ((c === "X" || c === "x") && s[i + 1] === "'") {
        const fim = s.indexOf("'", i + 2);
        linha.push(hexParaTexto(s.slice(i + 2, fim), decodificar));
        i = fim + 1;
      } else if ((c === "b" || c === "B") && s[i + 1] === "'") {
        const fim = s.indexOf("'", i + 2);
        linha.push(bitParaTexto(s.slice(i + 2, fim)));
        i = fim + 1;
      } else {
        let j = i;
        while (j < s.length && s[j] !== "," && s[j] !== ")") j++;
        const bruto = s.slice(i, j).trim();
        if (!bruto) throw new DumpError("valor vazio no INSERT");
        if (/^null$/i.test(bruto)) linha.push(null);
        else if (/^0x[0-9a-f]*$/i.test(bruto)) linha.push(hexParaTexto(bruto.slice(2), decodificar));
        else linha.push(bruto); // número ou palavra (CURRENT_TIMESTAMP…): sempre texto
        i = j;
      }
      pular();
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === ")") {
        i++;
        break;
      }
      throw new DumpError("tupla do INSERT sem fechamento");
    }
    linhas.push(linha);
    pular();
    if (s[i] === ",") {
      i++;
      pular();
      continue;
    }
    break;
  }
  return linhas;
}

// ---------------------------------------------------------------------------------------------
// Instruções
// ---------------------------------------------------------------------------------------------

const ident = (s: string) => s.trim().replace(/^`|`$/g, "").replace(/``/g, "`");

/** Nome da tabela, sem banco (`\`banco\`.\`tabela\`` → tabela) e o banco, quando qualificado. */
function nomeQualificado(bruto: string): { banco: string | null; nome: string } {
  const m = /^(`[^`]+`|\w+)\s*\.\s*(`[^`]+`|\w+)$/.exec(bruto.trim());
  if (m) return { banco: ident(m[1]), nome: ident(m[2]) };
  return { banco: null, nome: ident(bruto) };
}

/** Partes de primeiro nível de uma lista entre parênteses, separadas por vírgula fora de parênteses e aspas. */
function partesDeNivel(corpo: string): string[] {
  const out: string[] = [];
  let nivel = 0;
  let atual = "";
  let aspa: string | null = null;
  for (let i = 0; i < corpo.length; i++) {
    const c = corpo[i];
    if (aspa) {
      atual += c;
      if (c === "\\") {
        atual += corpo[++i] ?? "";
      } else if (c === aspa) aspa = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") aspa = c;
    else if (c === "(") nivel++;
    else if (c === ")") nivel--;
    else if (c === "," && nivel === 0) {
      out.push(atual.trim());
      atual = "";
      continue;
    }
    atual += c;
  }
  if (atual.trim()) out.push(atual.trim());
  return out;
}

function lerCreateTable(sql: string): { banco: string | null; nome: string; colunas: ColunaDump[]; pk: string[] } | null {
  const m = /^CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`[^`]+`|\w+)(?:\s*\.\s*(?:`[^`]+`|\w+))?)\s*\(/i.exec(sql);
  if (!m) return null;
  const inicio = m[0].length;
  const fim = sql.lastIndexOf(")");
  if (fim < inicio) return null;
  const colunas: ColunaDump[] = [];
  let pk: string[] = [];
  for (const parte of partesDeNivel(sql.slice(inicio, fim))) {
    const pkm = /^PRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(parte);
    if (pkm) {
      pk = pkm[1].split(",").map((c) => ident(c.replace(/\(\d+\)$/, "")));
      continue;
    }
    if (/^(KEY|UNIQUE|INDEX|CONSTRAINT|FOREIGN|FULLTEXT|SPATIAL|CHECK)\b/i.test(parte)) continue;
    const cm = /^(`(?:[^`]|``)+`|\w+)\s+([a-z]+(?:\s*\([^)]*\))?(?:\s+unsigned)?)/i.exec(parte);
    if (cm) colunas.push({ nome: ident(cm[1]), tipo: cm[2].toLowerCase() });
  }
  if (!colunas.length) return null;
  const { banco, nome } = nomeQualificado(m[1]);
  return { banco, nome, colunas, pk };
}

/**
 * Lê um ou mais arquivos do `mysqldump`. Erros fatais (`DumpError`): arquivo sem `CREATE TABLE`
 * reconhecível, UTF-8 inválido no modo `utf8`, tabela ambígua, INSERT malformado.
 */
export async function lerDumps(arquivos: string[], opcoes: OpcoesParser = {}): Promise<Dump> {
  const tabelas = new Map<string, TabelaDump>();
  for (const arquivo of arquivos) await lerArquivo(arquivo, tabelas, opcoes);
  return { tabelas, arquivos };
}

async function lerArquivo(arquivo: string, tabelas: Map<string, TabelaDump>, opcoes: OpcoesParser) {
  const encoding = opcoes.encoding ?? "utf8";
  const decoder = new TextDecoder(encoding === "utf8" ? "utf-8" : "latin1", { fatal: encoding === "utf8" });
  const decodificar = (b: Buffer) =>
    new TextDecoder(encoding === "utf8" ? "utf-8" : "latin1", { fatal: encoding === "utf8" }).decode(b);
  const divisor = new Divisor();
  const doArquivo = new Map<string, TabelaDump>(); // tabelas deste arquivo, por nome sem banco
  let bancoUse: string | null = null;
  let creates = 0;

  const bancoDe = (nome: string, qualificado: string | null): string => {
    if (qualificado) return qualificado;
    if (bancoUse) return bancoUse;
    const peloArquivo = bancoPeloArquivo(arquivo);
    if (peloArquivo) return peloArquivo;
    const candidatos = opcoes.bancoDaTabela?.(nome) ?? [];
    if (candidatos.length === 1) return candidatos[0];
    throw new DumpError(`tabela ambígua: ${nome} (arquivo ${basename(arquivo)} sem USE; use um dump por banco)`);
  };

  const processar = (sql: string) => {
    const use = /^USE\s+(`[^`]+`|\w+)/i.exec(sql);
    if (use) {
      bancoUse = ident(use[1]);
      return;
    }
    const cdb = /^CREATE\s+(?:DATABASE|SCHEMA)\s+(?:IF\s+NOT\s+EXISTS\s+)?(`[^`]+`|\w+)/i.exec(sql);
    if (cdb) {
      bancoUse = ident(cdb[1]);
      return;
    }
    if (/^CREATE\s+(?:TEMPORARY\s+)?TABLE/i.test(sql)) {
      const ct = lerCreateTable(sql);
      if (!ct) return;
      creates++;
      const banco = bancoDe(ct.nome, ct.banco);
      const chave = chaveTabela(banco, ct.nome);
      if (tabelas.has(chave)) {
        throw new DumpError(`tabela ambígua: ${chave} aparece mais de uma vez (${basename(tabelas.get(chave)!.arquivo)} e ${basename(arquivo)})`);
      }
      const t: TabelaDump = { banco, nome: ct.nome, colunas: ct.colunas, chavePrimaria: ct.pk, linhas: [], arquivo };
      tabelas.set(chave, t);
      doArquivo.set(ct.nome, t);
      return;
    }
    const ins = /^(?:INSERT|REPLACE)\s+(?:LOW_PRIORITY\s+|DELAYED\s+|HIGH_PRIORITY\s+)?(?:IGNORE\s+)?INTO\s+((?:`[^`]+`|\w+)(?:\s*\.\s*(?:`[^`]+`|\w+))?)\s*(\([^)]*\))?\s*VALUES\s*/i.exec(sql);
    if (ins) {
      const { banco: bq, nome } = nomeQualificado(ins[1]);
      const t = bq ? tabelas.get(chaveTabela(bq, nome)) : (doArquivo.get(nome) ?? tabelas.get(chaveTabela(bancoDe(nome, null), nome)));
      if (!t) throw new DumpError(`INSERT em ${nome} sem CREATE TABLE antes`);
      const lista = ins[2] ? ins[2].slice(1, -1).split(",").map(ident) : null;
      const posicoes = lista
        ? lista.map((c) => {
            const p = t.colunas.findIndex((col) => col.nome === c);
            if (p < 0) throw new DumpError(`INSERT em ${t.banco}.${t.nome} cita a coluna ${c}, ausente do CREATE TABLE`);
            return p;
          })
        : null;
      const descartadas = t.colunas.map((c) => opcoes.descartar?.has(`${t.banco}.${t.nome}.${c.nome}`) ?? false);
      for (const tupla of lerTuplas(sql, ins[0].length, decodificar)) {
        const n = posicoes ? posicoes.length : t.colunas.length;
        if (tupla.length !== n) throw new DumpError(`INSERT em ${t.banco}.${t.nome} com ${tupla.length} valores para ${n} colunas`);
        let linha: Valor[];
        if (posicoes) {
          linha = t.colunas.map(() => null);
          posicoes.forEach((p, k) => (linha[p] = tupla[k]));
        } else linha = tupla;
        // A senha do legado (e qualquer coluna descartada) não fica em memória.
        for (let k = 0; k < linha.length; k++) if (descartadas[k]) linha[k] = null;
        t.linhas.push(linha);
      }
    }
    // SET, LOCK/UNLOCK TABLES, DROP, ALTER … KEYS e o resto: ignorados.
  };

  const stream = createReadStream(arquivo);
  try {
    for await (const chunk of stream) {
      let texto: string;
      try {
        texto = decoder.decode(chunk as Buffer, { stream: true });
      } catch {
        throw new DumpError(`${basename(arquivo)}: texto com sequência UTF-8 inválida; se o dump estiver em latin1, rode com --encoding latin1`);
      }
      // O dump não traz NUL fora de strings; NUL cru indica arquivo binário (PDF, imagem).
      if (creates === 0 && /\u0000/.test(texto) && !/CREATE\s+TABLE/i.test(texto)) {
        throw new DumpError(`${basename(arquivo)}: ${MSG_NAO_E_DUMP}`);
      }
      divisor.push(texto);
      for (const sql of divisor.prontas.splice(0)) processar(sql);
    }
    try {
      divisor.push(decoder.decode());
    } catch {
      throw new DumpError(`${basename(arquivo)}: texto com sequência UTF-8 inválida; se o dump estiver em latin1, rode com --encoding latin1`);
    }
    divisor.fim();
    for (const sql of divisor.prontas.splice(0)) processar(sql);
  } catch (error) {
    if (error instanceof DumpError) {
      // UTF-8 inválido em arquivo que nem é dump (ex.: PDF): a mensagem certa é "não parece um dump".
      if (creates === 0 && !/não parece/.test(error.message)) throw new DumpError(`${basename(arquivo)}: ${MSG_NAO_E_DUMP} (${error.message})`);
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new DumpError(`arquivo não encontrado: ${arquivo}`);
    throw error;
  } finally {
    stream.destroy();
  }
  if (creates === 0) throw new DumpError(`${basename(arquivo)}: ${MSG_NAO_E_DUMP} (nenhum CREATE TABLE reconhecido)`);
}
