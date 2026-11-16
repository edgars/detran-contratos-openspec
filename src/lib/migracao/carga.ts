import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as prismaApp } from "@/lib/db";
import { DumpError, chaveTabela, lerDumps, type Dump, type Encoding, type TabelaDump, type Valor } from "./dump-parser";
import { COLUNAS_DESCARTADAS, MAPA, bancosDaTabela, conferirMapa, type ColunaMapa, type Modelo, type TabelaMapa } from "./mapa";
import * as conv from "./conversoes";
import { ImportadorAnexos } from "./anexos";
import {
  caminhoRelatorio,
  carimbo,
  gravarRelatorio,
  pendenciasCadastro,
  relatorioVazio,
  resumo,
  type Arredondamento,
  type Aviso,
  type ContagemTabela,
  type Relatorio,
} from "./relatorio";
import { USUARIO_TECNICO, garantirUsuarioTecnico, hashDescartado, perfisDoUsuario } from "./usuarios";

/**
 * Carga do legado (025-migracao-legado, design.md D2–D10). `executarCarga` é o que o comando
 * `npm run migrar` (scripts/migrar.ts) e os testes chamam: lê o dump, confere o mapa, aplica as
 * proteções da carga real, carrega tudo numa transação única na ordem de D4 (upsert por chave, sem
 * nunca apagar) e gera o relatório de conferência. Em simulação a transação é desfeita no fim.
 */

export type OpcoesCarga = {
  origens: string[];
  anexos?: string;
  encoding?: Encoding;
  simular?: boolean;
  confirmar?: boolean;
  /** Caminho do relatório JSON (padrão: data/migracao/relatorio-<data-hora>[-simulacao].json). */
  relatorio?: string;
  dirRelatorios?: string;
  /** Pasta do backup `pre-migracao-*.db` (padrão: BACKUP_DIR ou data/backups). */
  dirBackups?: string;
  /** Cliente do banco de destino (padrão: o do app, `DATABASE_URL`). */
  db?: PrismaClient;
  /** Script do resolvedor de gestores da 022 rodado ao fim da carga real; `false` não roda. */
  resolvedor?: string | false;
  /** Só para teste: erro inesperado ao chegar na tabela de destino dada (ex.: "pagamentos"). */
  falharEm?: string;
};

export type ResultadoCarga = { codigo: 0 | 1 | 2; relatorio: Relatorio; arquivoRelatorio: string; resumo: string };

export const MSG_CONFIRMAR =
  "carga real recusada: rode antes com --simular e confira o relatório; para gravar, use --confirmar";
export const MSG_DADOS_DO_APP =
  "o banco já tem dados criados no app (contratos, pagamentos ou fiscais) e nenhuma carga real anterior; a carga deve rodar antes da virada, com o banco vazio";
export const MSG_APP_EM_USO = "há sessão aberta nos últimos 5 minutos: pare o app (docker compose stop app) antes da carga real";

const TIMEOUT_TRANSACAO = 30 * 60 * 1000;
/** Tipos de contrato sujeitos à prestação de contas no legado (021; docs/legado/prestacao-contas.md). */
const TIPOS_PRESTACAO_CONTAS = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 13]);
/** Limites das telas (020; docs/legado/contratos-complementos.md): só aviso, o texto entra inteiro. */
const LIMITES_TEXTO: Record<string, number> = { numeroProcesso: 45, numeroContrato: 45, objeto: 200, numeroModalidade: 12 };
/** Colunas de autoria obrigatórias que recebem `legado.desconhecido` quando o autor sumiu (D7). */
const AUTORIA_OBRIGATORIA = new Set(["prestacao_contas.userId", "penalidades.userId"]);
const SOMATORIOS: Record<string, string[]> = { contratos: ["valorTotal", "valorInicial", "valorMensal"], pagamentos: ["valor", "valorGlosa"] };
/** Tabelas filhas de contrato (D4, passos 11–19): `contrato_id` inexistente → rejeitada. */
const FILHAS_DE_CONTRATO = new Set([
  "contrato_status",
  "fiscais",
  "pagamentos",
  "historicos",
  "prestacao_contas",
  "penalidades",
  "anexos_fiscais",
  "anexos_publicacao",
]);

/** Erro sentinela que desfaz a transação da simulação (D9). */
class FimDaSimulacao extends Error {}

type Db = Prisma.TransactionClient;
type Registro = Record<string, unknown>;
type Delegado = {
  findMany(args?: object): Promise<Registro[]>;
  create(args: object): Promise<Registro>;
  createMany(args: object): Promise<unknown>;
  update(args: object): Promise<Registro>;
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Campos obrigatórios (sem default) de cada modelo, lidos do `Prisma.dmmf`. */
const OBRIGATORIOS: Map<string, Set<string>> = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [
    lowerFirst(m.name),
    new Set(m.fields.filter((f) => f.kind === "scalar" && f.isRequired && !f.hasDefaultValue).map((f) => f.name)),
  ]),
);

function normalizar(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (Prisma.Decimal.isDecimal(v)) return (v as Prisma.Decimal).toFixed(2);
  if (v instanceof Date) return v.getTime();
  return v;
}

/** Campos de `data` que diferem do registro atual. */
function diferencas(atual: Registro, data: Registro): string[] {
  return Object.keys(data).filter((k) => normalizar(atual[k]) !== normalizar(data[k]));
}

const sha256Arquivo = async (arquivo: string) => createHash("sha256").update(await readFile(arquivo)).digest("hex");

type LinhaDump = { idLegado: string | null; valores: Record<string, Valor> };

/** Chave normalizada de um id do legado (`"007"` → `"7"`). */
function chaveLegado(v: Valor | undefined): string | null {
  if (v === null || v === undefined) return null;
  const r = conv.inteiro(v);
  return r.ok && r.valor !== null ? String(r.valor) : v;
}

function linhasDe(t: TabelaDump): LinhaDump[] {
  const pk = t.chavePrimaria.length === 1 ? t.chavePrimaria[0] : "id";
  const idx = t.colunas.findIndex((c) => c.nome === pk);
  return t.linhas.map((l) => ({
    idLegado: idx >= 0 ? l[idx] : null,
    valores: Object.fromEntries(t.colunas.map((c, i) => [c.nome, l[i]])),
  }));
}

type Convertida = {
  data: Registro;
  extras: Record<string, Valor>;
  arredondamentos: Arredondamento[];
  avisos: Aviso[];
  /** Ações depois que a linha foi aceita (ex.: pendência em `migracao_pendencias`). */
  depois: ((id: number) => Promise<void>)[];
};

type Contagem = ContagemTabela;

/** Execução da carga dentro da transação. */
class Carga {
  private ids = new Map<string, Set<number>>();
  private usuarioPorLegado = new Map<string, number>();
  private fornecedorPorCnpj = new Map<string, number>();
  private cpfsPessoas = new Set<string>();
  private idsPessoas = new Set<number>();
  private tecnico: number | null = null;

  constructor(
    private readonly tx: Db,
    private readonly dump: Dump,
    private readonly rel: Relatorio,
    private readonly anexos: ImportadorAnexos,
    private readonly op: OpcoesCarga,
  ) {}

  private del(m: Modelo): Delegado {
    return (this.tx as unknown as Record<string, Delegado>)[m];
  }

  private async idsDe(m: Modelo): Promise<Set<number>> {
    let s = this.ids.get(m);
    if (!s) {
      s = new Set((await this.del(m).findMany({ select: { id: true } })).map((r) => r.id as number));
      this.ids.set(m, s);
    }
    return s;
  }

  private aviso(a: Aviso) {
    this.rel.avisos.push(a);
  }

  async executar() {
    for (const t of [...MAPA].sort((a, b) => a.ordem - b.ordem)) {
      if (this.op.falharEm === t.destino) throw new Error(`falha injetada ao gravar ${t.destino}`);
      const dt = this.dump.tabelas.get(chaveTabela(t.banco, t.origem));
      if (!dt) continue;
      if (t.modelo === "user") await this.carregarUsuarios(t, dt);
      else await this.carregarTabela(t, dt);
      if (t.modelo === "pessoaFisica") {
        const todas = await this.tx.pessoaFisica.findMany({ where: { cpf: { not: null } }, select: { cpf: true } });
        this.cpfsPessoas = new Set(todas.map((p) => p.cpf!));
      }
      if (t.modelo === "prestadorServico") {
        const todos = await this.tx.prestadorServico.findMany({ where: { cnpj: { not: null } }, select: { id: true, cnpj: true } });
        this.fornecedorPorCnpj = new Map(todos.map((p) => [p.cnpj!, p.id]));
      }
      if (t.modelo === "pessoa") this.idsPessoas = await this.idsDe("pessoa");
    }
    // Referências que não vieram no dump: lidas do destino.
    if (!this.dump.tabelas.has("global.prestadores_servicos")) {
      const todos = await this.tx.prestadorServico.findMany({ where: { cnpj: { not: null } }, select: { id: true, cnpj: true } });
      this.fornecedorPorCnpj = new Map(todos.map((p) => [p.cnpj!, p.id]));
    }
  }

  // -------------------------------------------------------------------------------------------
  // Conversão de uma linha
  // -------------------------------------------------------------------------------------------

  private async converter(t: TabelaMapa, l: LinhaDump, validar: (c: Convertida) => Promise<string | null>): Promise<Convertida | { motivo: string }> {
    const obrigatorios = OBRIGATORIOS.get(t.modelo) ?? new Set<string>();
    const c: Convertida = { data: {}, extras: {}, arredondamentos: [], avisos: [], depois: [] };
    const id = l.idLegado;
    const avisar = (tipo: Aviso["tipo"], detalhe: string) => c.avisos.push({ tipo, tabela: t.destino, idLegado: id, detalhe });
    // Anexos por último: só depois da validação, para não copiar arquivo de linha rejeitada.
    const colunas = [...t.colunas.filter((x) => x.conv !== "anexo"), ...t.colunas.filter((x) => x.conv === "anexo")];
    let validou = false;
    for (const col of colunas) {
      if (col.conv === "anexo" && !validou) {
        const motivo = await validar(c);
        if (motivo) return { motivo };
        validou = true;
      }
      const bruto = l.valores[col.origem] ?? null;
      const obrigatorio = obrigatorios.has(col.destino);
      const r = await this.converterValor(t, col, bruto, obrigatorio, id, c, avisar);
      if (r) return { motivo: r };
    }
    if (!validou) {
      const motivo = await validar(c);
      if (motivo) return { motivo };
    }
    for (const campo of obrigatorios) {
      if (campo in c.data && (c.data[campo] === null || c.data[campo] === undefined)) {
        return { motivo: `${campo} ausente (obrigatório no modelo)` };
      }
    }
    return c;
  }

  /** Converte um valor para `c.data`; devolve o motivo quando a linha deve ser rejeitada. */
  private async converterValor(
    t: TabelaMapa,
    col: ColunaMapa,
    bruto: Valor,
    obrigatorio: boolean,
    id: string | null,
    c: Convertida,
    avisar: (tipo: Aviso["tipo"], detalhe: string) => void,
  ): Promise<string | null> {
    const d = col.destino;
    switch (col.conv) {
      case "legado":
        c.extras[d] = bruto;
        return null;
      case "id": {
        const r = conv.inteiro(bruto);
        if (!r.ok || r.valor === null) return `id inválido: ${bruto ?? "nulo"}`;
        c.data[d] = r.valor;
        return null;
      }
      case "texto":
      case "inteiro":
      case "simNao":
      case "zeroUm":
      case "zeroUmTexto": {
        const r = conv[col.conv](bruto);
        if (!r.ok) return `${d} inválido (${r.erro})`;
        c.data[d] = r.valor;
        return null;
      }
      case "data":
      case "dataHora": {
        const r = conv[col.conv](bruto);
        if (r.ok) c.data[d] = r.valor;
        // RK-774f44ed6df9 — competencia (e toda data obrigatória) inválida rejeita a linha; opcional vira nulo.
        else if (obrigatorio) return `${d} inválida`;
        else c.data[d] = null;
        if (obrigatorio && c.data[d] === null) return `${d} inválida`;
        return null;
      }
      case "cpf":
      case "cnpj": {
        const r = conv[col.conv](bruto);
        if (!r.ok) return `${d} inválido (${r.erro})`;
        c.data[d] = r.valor;
        if (r.aviso) avisar("dv_invalido", `${d}: ${r.valor}`);
        return null;
      }
      case "dinheiro": {
        const r = conv.dinheiro(bruto);
        if (!r.ok) return `${d} inválido (${r.erro})`;
        c.data[d] = r.valor?.decimal ?? null;
        if (r.valor?.arredondado) {
          c.arredondamentos.push({ tabela: t.destino, id, coluna: d, origem: bruto!.trim(), gravado: conv.dinheiroTexto(r.valor.decimal) });
        }
        return null;
      }
      case "anexo": {
        const r = await this.anexos.resolver(this.tx, bruto);
        if (r.ok) {
          c.data[d] = r.nome;
          return null;
        }
        // RK-77287deac605 (pagamento_arquivos.arquivo), RK-0e70b6c81ee9/RK-9da08201400b (anexos_fiscais.anexo):
        // anexo obrigatório sem arquivo válido rejeita a linha; opcional fica nulo com aviso.
        if (obrigatorio) return r.motivo;
        c.data[d] = null;
        avisar(r.aviso, `${d}: ${r.motivo} (${bruto})`);
        return null;
      }
      case "usuario": {
        const legado = chaveLegado(bruto);
        const novo = legado === null ? undefined : this.usuarioPorLegado.get(legado);
        if (novo !== undefined) {
          c.data[d] = novo;
          return null;
        }
        if (AUTORIA_OBRIGATORIA.has(`${t.destino}.${d}`)) {
          c.data[d] = await this.usuarioTecnico();
          avisar("autor_desconhecido", `${d}: usuário ${bruto ?? "nulo"} do legado não existe no dump; atribuído a ${USUARIO_TECNICO}`);
          return null;
        }
        if (obrigatorio) return `usuário inexistente (${bruto ?? "nulo"})`;
        c.data[d] = null;
        if (legado !== null) avisar("autor_desconhecido", `${d}: usuário ${bruto} do legado não existe no dump; gravado sem autor`);
        return null;
      }
      case "fornecedor": {
        const r = conv.cnpj(bruto);
        if (!r.ok) return `${d} inválido (${r.erro})`;
        if (r.valor === null) {
          c.data[d] = null;
          return null;
        }
        const fornecedor = this.fornecedorPorCnpj.get(r.valor);
        if (fornecedor !== undefined) {
          c.data[d] = fornecedor;
          return null;
        }
        // 022 › D8: CNPJ sem fornecedor é erro de checagem; o contrato entra com o campo nulo e vira pendência.
        c.data[d] = null;
        avisar("cnpj_sem_fornecedor", `${d}: CNPJ ${r.valor} não existe em global.prestadores_servicos`);
        const cnpjAntigo = r.valor;
        c.depois.push(async (registroId) => {
          const where = { origem: "025", tabela: t.destino, registroId, campo: d, valorAntigo: cnpjAntigo, resolvidoEm: null };
          if (await this.tx.migracaoPendencia.findFirst({ where })) return;
          await this.tx.migracaoPendencia.create({
            data: { origem: "025", tabela: t.destino, registroId, campo: d, valorAntigo: cnpjAntigo, motivo: "CNPJ sem fornecedor" },
          });
        });
        return null;
      }
    }
  }

  private async usuarioTecnico(): Promise<number> {
    if (this.tecnico === null) {
      const r = await garantirUsuarioTecnico(this.tx);
      this.tecnico = r.id;
      this.rel.usuarios.usuarioTecnico = USUARIO_TECNICO;
    }
    return this.tecnico;
  }

  // -------------------------------------------------------------------------------------------
  // Validação por tabela (referências)
  // -------------------------------------------------------------------------------------------

  private async validar(t: TabelaMapa, c: Convertida, avisar: (tipo: Aviso["tipo"], detalhe: string) => void): Promise<string | null> {
    const d = c.data;
    if (FILHAS_DE_CONTRATO.has(t.destino)) {
      if (!(await this.idsDe("contrato")).has(d.contratoId as number)) return "contrato inexistente";
    }
    switch (t.destino) {
      case "departamentos":
        if (!(await this.idsDe("diretoria")).has(d.diretoriaId as number)) return "diretoria inexistente";
        break;
      case "tipo_contrato":
        // 021: tipos 3–11 e 13 sujeitos à prestação de contas (lista fixa do legado).
        if (TIPOS_PRESTACAO_CONTAS.has(d.id as number)) d.prestacaoContas = "S";
        break;
      case "contrato_status":
        // RK-a7017eb6c42d RK-067d06861847 — status do andamento é obrigatório: nulo ou inexistente rejeita a linha.
        if (d.statusId === null || !(await this.idsDe("status")).has(d.statusId as number)) {
          return "status do andamento ausente ou inexistente (RK-a7017eb6c42d, RK-067d06861847)";
        }
        break;
      case "pagamento_arquivos":
        if (!(await this.idsDe("pagamento")).has(d.pagamentoId as number)) return "pagamento inexistente";
        break;
      case "fiscais":
        if (d.pessoaFisicaCpf && !this.cpfsPessoas.has(d.pessoaFisicaCpf as string)) {
          avisar("cpf_sem_pessoa", `pessoaFisicaCpf: ${d.pessoaFisicaCpf}`);
        }
        break;
      case "contratos": {
        if (d.parentId !== null && !(await this.idsDe("contrato")).has(d.parentId as number)) return "aditivo sem contrato original";
        const refs: [string, Modelo][] = [
          ["departamentoId", "departamento"],
          ["tipoContratoId", "tipoContrato"],
          ["modalidadeId", "modalidade"],
          ["situacaoContratualId", "situacaoContratual"],
        ];
        for (const [campo, modelo] of refs) {
          if (d[campo] !== null && !(await this.idsDe(modelo)).has(d[campo] as number)) {
            avisar("referencia_inexistente", `${campo}: ${d[campo]} não existe; gravado nulo`);
            d[campo] = null;
          }
        }
        for (const campo of ["pessoaFisicaId", "suplenteId"]) {
          // 022 › D1: o CPF do gestor entra mesmo sem pessoa correspondente.
          if (d[campo] && !this.cpfsPessoas.has(d[campo] as string)) avisar("cpf_sem_pessoa", `${campo}: ${d[campo]}`);
        }
        for (const [campo, limite] of Object.entries(LIMITES_TEXTO)) {
          const v = d[campo];
          if (typeof v === "string" && v.length > limite) avisar("texto_acima_do_limite", `${campo}: ${v.length} caracteres (limite ${limite}); gravado inteiro`);
        }
        break;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------------------------
  // Carga genérica (upsert por chave)
  // -------------------------------------------------------------------------------------------

  private contagem(t: TabelaMapa, lidas: number): Contagem {
    const c: Contagem = {
      destino: t.destino,
      origem: `${t.banco}.${t.origem}`,
      lidas,
      inseridas: 0,
      atualizadas: 0,
      inalteradas: 0,
      rejeitadas: 0,
      naoCarregadas: 0,
    };
    this.rel.tabelas.push(c);
    return c;
  }

  private rejeitar(t: TabelaMapa, cont: Contagem, idLegado: string | null, motivo: string) {
    cont.rejeitadas++;
    this.rel.rejeitados.push({ tabela: t.destino, idLegado, motivo });
  }

  private async carregarTabela(t: TabelaMapa, dt: TabelaDump) {
    const todas = linhasDe(dt);
    const cont = this.contagem(t, todas.length);
    const del = this.del(t.modelo);
    const existentes = new Map<string, Registro>();
    for (const r of await del.findMany()) if (r[t.chave] !== null && r[t.chave] !== undefined) existentes.set(String(r[t.chave]), r);
    const ids = await this.idsDe(t.modelo);
    const chavesDoDump = new Set<string>();
    const somar = SOMATORIOS[t.destino] ?? [];
    const somaOrigem = Object.fromEntries(somar.map((c) => [c, new Prisma.Decimal(0)]));
    const somaArred = Object.fromEntries(somar.map((c) => [c, new Prisma.Decimal(0)]));
    const carregados: number[] = [];

    for (const l of todas) {
      for (const campo of somar) {
        const col = t.colunas.find((c) => c.destino === campo)!;
        const r = conv.dinheiro(l.valores[col.origem] ?? null);
        if (r.ok && r.valor) somaOrigem[campo] = somaOrigem[campo].plus(r.valor.exato);
      }
    }

    const lotes = await this.ordenar(t, todas, cont);
    for (const lote of lotes) {
      const inserir: { data: Registro; c: Convertida }[] = [];
      for (const l of lote) {
        const pendentes: Aviso[] = [];
        const r = await this.converter(t, l, (c) =>
          this.validar(t, c, (tipo, detalhe) => pendentes.push({ tipo, tabela: t.destino, idLegado: l.idLegado, detalhe })),
        );
        if ("motivo" in r) {
          this.rejeitar(t, cont, l.idLegado, r.motivo);
          continue;
        }
        const chave = r.data[t.chave];
        if (chave === null || chave === undefined) {
          cont.naoCarregadas++;
          continue;
        }
        const k = String(chave);
        if (chavesDoDump.has(k)) {
          this.rejeitar(t, cont, l.idLegado, `${t.chave} repetido no dump (${k})`);
          continue;
        }
        chavesDoDump.add(k);
        for (const a of [...r.avisos, ...pendentes]) this.rel.avisos.push(a);
        this.rel.arredondamentos.push(...r.arredondamentos);
        const atual = existentes.get(k);
        if (!atual) {
          inserir.push({ data: r.data, c: r });
          cont.inseridas++;
        } else {
          const dif = diferencas(atual, r.data);
          const id = atual.id as number;
          if (dif.length) {
            const { id: _ignorado, ...semId } = r.data;
            void _ignorado;
            await del.update({ where: { id }, data: semId });
            cont.atualizadas++;
          } else cont.inalteradas++;
          for (const f of r.depois) await f(id);
        }
        if (t.destino === "contratos") this.posContrato(r.data, l.idLegado);
        for (const campo of somar) {
          const v = r.data[campo];
          if (v) somaArred[campo] = somaArred[campo].plus(v as Prisma.Decimal);
        }
        if (t.chave === "id") carregados.push(r.data.id as number);
      }
      // Inserção em lote; com id preservado, o AUTOINCREMENT do SQLite passa a valer depois do maior id do legado.
      for (let i = 0; i < inserir.length; i += 500) {
        await del.createMany({ data: inserir.slice(i, i + 500).map((x) => x.data) });
      }
      for (const x of inserir) {
        if (t.chave !== "id") continue;
        ids.add(x.data.id as number);
        for (const f of x.c.depois) await f(x.data.id as number);
      }
    }
    for (const r of existentes.values()) ids.add(r.id as number);
    for (const k of existentes.keys()) if (!chavesDoDump.has(k)) this.rel.existentesForaDoDump.push({ tabela: t.destino, chave: k });

    if (somar.length) {
      const gravados = carregados.length
        ? await del.findMany({ where: { id: { in: carregados } }, select: Object.fromEntries(somar.map((c) => [c, true])) })
        : [];
      for (const campo of somar) {
        const destino = gravados.reduce<Prisma.Decimal>((acc, g) => (g[campo] ? acc.plus(g[campo] as Prisma.Decimal) : acc), new Prisma.Decimal(0));
        this.rel.somatorios.push({
          campo: `${t.destino}.${campo}`,
          origem: somaOrigem[campo].toString(),
          origemArredondada: somaArred[campo].toFixed(2),
          destino: destino.toFixed(2),
          diferenca: somaArred[campo].minus(destino).toFixed(2),
        });
      }
    }
  }

  /** Pendências de cadastro e contagem de originais sem valor inicial (D5, D8). */
  private posContrato(d: Registro, idLegado: string | null) {
    // RK-c3fbde6dbf4a não se aplica na carga: ver design.md D5 (valorInicial copiado como está, inclusive nulo).
    if (d.parentId === null && d.valorInicial === null) this.rel.contratosSemValorInicial++;
    for (const p of pendenciasCadastro(d)) {
      this.aviso({ tipo: "pendencia_cadastro", tabela: "contratos", idLegado, detalhe: `${p.rk}: ${p.campo} ausente no legado` });
    }
  }

  /**
   * Lotes na ordem de gravação. Contratos: originais primeiro, depois os aditivos em ordem
   * topológica (pai antes do filho). Pessoas físicas: uma linha por CPF (022 › D8). Fornecedores:
   * uma linha por CNPJ. Linhas fora dos lotes contam como não carregadas.
   */
  private async ordenar(t: TabelaMapa, linhas: LinhaDump[], cont: Contagem): Promise<LinhaDump[][]> {
    if (t.destino === "contratos") return this.ordenarContratos(t, linhas, cont);
    if (t.destino === "pessoas_fisicas") return [this.unicaPorDocumento(t, linhas, cont, "CPF", "cpf_duplicado", conv.cpf)];
    if (t.destino === "prestadores_servicos") return [this.unicaPorDocumento(t, linhas, cont, "CNPJ", "cnpj_duplicado", conv.cnpj)];
    return [linhas];
  }

  private unicaPorDocumento(
    t: TabelaMapa,
    linhas: LinhaDump[],
    cont: Contagem,
    coluna: string,
    tipo: "cpf_duplicado" | "cnpj_duplicado",
    normalizar: (v: Valor) => conv.Resultado<string>,
  ): LinhaDump[] {
    const grupos = new Map<string, LinhaDump[]>();
    const out: LinhaDump[] = [];
    for (const l of linhas) {
      const r = normalizar(l.valores[coluna] ?? null);
      if (!r.ok) {
        out.push(l); // a conversão rejeita com o motivo
        continue;
      }
      if (r.valor === null) {
        cont.naoCarregadas++; // sem CPF/CNPJ: não entra na referência
        continue;
      }
      grupos.set(r.valor, [...(grupos.get(r.valor) ?? []), l]);
    }
    const idPessoa = (l: LinhaDump) => {
      const r = conv.inteiro(l.valores.IdPessoaFisica ?? null);
      return r.ok && r.valor !== null ? r.valor : -1;
    };
    for (const [doc, gs] of grupos) {
      // CPF duplicado no global: vale a linha com DtExcluido nulo e maior IdPessoaFisica (022 › D8).
      const ordenadas =
        t.destino === "pessoas_fisicas"
          ? [...gs].sort((a, b) => Number(a.valores.DtExcluido != null) - Number(b.valores.DtExcluido != null) || idPessoa(b) - idPessoa(a))
          : [...gs].reverse();
      out.push(ordenadas[0]);
      for (const outra of ordenadas.slice(1)) {
        cont.naoCarregadas++;
        this.aviso({
          tipo,
          tabela: t.destino,
          idLegado: outra.idLegado ?? outra.valores.IdPessoaFisica ?? null,
          detalhe: `${coluna} ${doc} repetido no ${t.banco}; carregada outra linha`,
        });
      }
    }
    return out;
  }

  private async ordenarContratos(t: TabelaMapa, linhas: LinhaDump[], cont: Contagem): Promise<LinhaDump[][]> {
    const pai = (l: LinhaDump) => {
      const r = conv.inteiro(l.valores.parent_id ?? null);
      return r.ok ? r.valor : null;
    };
    const idDe = (l: LinhaDump) => {
      const r = conv.inteiro(l.idLegado);
      return r.ok ? r.valor : null;
    };
    const lotes: LinhaDump[][] = [linhas.filter((l) => pai(l) === null)];
    let restantes = linhas.filter((l) => pai(l) !== null);
    const destino = await this.idsDe("contrato");
    let conhecidos = new Set<number>([...destino, ...lotes[0].map(idDe).filter((x): x is number => x !== null)]);
    while (restantes.length) {
      const prontos = restantes.filter((l) => conhecidos.has(pai(l)!));
      if (!prontos.length) break;
      lotes.push(prontos);
      conhecidos = new Set([...conhecidos, ...prontos.map(idDe).filter((x): x is number => x !== null)]);
      restantes = restantes.filter((l) => !prontos.includes(l));
    }
    // Pai ausente no dump e no destino (ou ciclo): rejeitado.
    for (const l of restantes) this.rejeitar(t, cont, l.idLegado, "aditivo sem contrato original");
    return lotes;
  }

  // -------------------------------------------------------------------------------------------
  // Usuários (D7)
  // -------------------------------------------------------------------------------------------

  private async carregarUsuarios(t: TabelaMapa, dt: TabelaDump) {
    const todas = linhasDe(dt);
    const cont = this.contagem(t, todas.length);
    const nomesGrupo = new Map<string, string>();
    const gTab = this.dump.tabelas.get("contratos.groups");
    if (gTab) for (const g of linhasDe(gTab)) if (g.idLegado !== null) nomesGrupo.set(chaveLegado(g.idLegado)!, g.valores.name ?? "");
    const gruposDoUsuario = new Map<string, string[]>();
    const guTab = this.dump.tabelas.get("contratos.groups_users");
    if (guTab) {
      for (const gu of linhasDe(guTab)) {
        const u = chaveLegado(gu.valores.user_id);
        const nome = nomesGrupo.get(chaveLegado(gu.valores.group_id) ?? "");
        if (u === null || u === undefined || nome === undefined) continue;
        gruposDoUsuario.set(u, [...(gruposDoUsuario.get(u) ?? []), nome]);
      }
    }
    const existentes = new Map(
      (await this.tx.user.findMany({ include: { perfis: { select: { perfil: true } } } })).map((u) => [u.username, u]),
    );
    const vistos = new Set<string>();
    const semMapeamento = new Set(this.rel.usuarios.gruposSemMapeamento);
    const pessoas = this.idsPessoas.size ? this.idsPessoas : await this.idsDe("pessoa");

    for (const l of todas) {
      const r = await this.converter(t, l, async () => null);
      if ("motivo" in r) {
        this.rejeitar(t, cont, l.idLegado, r.motivo);
        continue;
      }
      const username = r.data.username as string | null;
      const idLegado = r.extras.idLegado;
      if (!username) {
        this.rejeitar(t, cont, l.idLegado, "username ausente");
        continue;
      }
      if (vistos.has(username)) {
        this.rejeitar(t, cont, l.idLegado, `username repetido no dump (${username})`);
        continue;
      }
      vistos.add(username);
      const grupos = gruposDoUsuario.get(chaveLegado(idLegado) ?? "") ?? [];
      const { perfis, semMapeamento: sm } = perfisDoUsuario(grupos, (r.data.superuser as number | null) ?? null);
      for (const g of sm) semMapeamento.add(g);
      const inativo = conv.zeroUm(r.extras.inativoLegado ?? null);
      if (inativo.ok && inativo.valor === 1) this.rel.usuarios.usuariosInativosNoLegado.push(username);
      const atual = existentes.get(username);
      if (atual) {
        // Usuário já existente: senha, inativo e senhaRedefinir não mudam; só acrescenta perfis que faltam.
        const tem = new Set(atual.perfis.map((p) => p.perfil));
        const faltam = perfis.filter((p) => !tem.has(p));
        if (faltam.length) {
          await this.tx.userPerfil.createMany({ data: faltam.map((perfil) => ({ userId: atual.id, perfil })) });
          cont.atualizadas++;
        } else cont.inalteradas++;
        this.rel.usuarios.existentes.push(username);
        if (atual.senhaRedefinir) this.rel.usuarios.precisamDeSenha.push(username);
        const chaveAtual = chaveLegado(idLegado);
        if (chaveAtual !== null) this.usuarioPorLegado.set(chaveAtual, atual.id);
        continue;
      }
      const pessoaId = r.data.pessoaId as number | null;
      const novo = await this.tx.user.create({
        data: {
          username,
          // Nenhuma senha migra (D7): hash de 32 bytes aleatórios descartados; inativo até o Administrador definir a senha.
          passwordHash: await hashDescartado(),
          inativo: 1,
          senhaRedefinir: true,
          created: (r.data.created as Date | null) ?? undefined,
          modified: (r.data.modified as Date | null) ?? undefined,
          pessoaId: pessoaId !== null && pessoas.has(pessoaId) ? pessoaId : null,
          superuser: r.data.superuser as number | null,
          ultimoLogin: r.data.ultimoLogin as Date | null,
          perfis: { create: perfis.map((perfil) => ({ perfil })) },
        },
        select: { id: true },
      });
      cont.inseridas++;
      for (const p of perfis) this.rel.usuarios.perfisAtribuidos[p] = (this.rel.usuarios.perfisAtribuidos[p] ?? 0) + 1;
      this.rel.usuarios.criados.push(username);
      this.rel.usuarios.precisamDeSenha.push(username);
      const chaveNovo = chaveLegado(idLegado);
      if (chaveNovo !== null) this.usuarioPorLegado.set(chaveNovo, novo.id);
    }
    this.rel.usuarios.gruposSemMapeamento = [...semMapeamento].sort();
    for (const u of existentes.keys()) {
      if (!vistos.has(u) && u !== USUARIO_TECNICO) this.rel.existentesForaDoDump.push({ tabela: "users", chave: u });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------------

/** Carga completa: leitura, conferência, proteções, transação e relatório. Código 0, 2 (rejeições) ou 1 (abortada). */
export async function executarCarga(op: OpcoesCarga): Promise<ResultadoCarga> {
  const db = op.db ?? prismaApp;
  const inicio = new Date();
  const simular = Boolean(op.simular);
  const rel = relatorioVazio(simular, inicio);
  const arquivo = caminhoRelatorio({ relatorio: op.relatorio, dirRelatorios: op.dirRelatorios, simular }, inicio);
  let execucaoId: number | null = null;

  const terminar = async (codigo: 0 | 1 | 2, situacao: string): Promise<ResultadoCarga> => {
    rel.execucao = { ...rel.execucao, id: execucaoId, fim: new Date().toISOString(), situacao, codigoSaida: codigo };
    if (execucaoId !== null) {
      await db.migracaoExecucao.update({
        where: { id: execucaoId },
        data: { concluidoEm: new Date(), situacao, relatorio: JSON.stringify(rel) },
      });
    }
    await gravarRelatorio(arquivo, rel);
    return { codigo, relatorio: rel, arquivoRelatorio: arquivo, resumo: resumo(rel, arquivo) };
  };
  const abortar = (mensagem: string) => {
    rel.erros.push(mensagem);
    return terminar(1, "abortada");
  };

  if (!op.origens.length) return abortar("informe ao menos um --origem <arquivo.sql>");
  if (!simular && !op.confirmar) return abortar(MSG_CONFIRMAR);

  // 1. Leitura do dump (nada gravado se falhar).
  let dump: Dump;
  try {
    for (const o of op.origens) rel.origem.arquivos.push({ arquivo: resolve(o), sha256: await sha256Arquivo(o) });
    dump = await lerDumps(op.origens, { encoding: op.encoding, descartar: COLUNAS_DESCARTADAS, bancoDaTabela: bancosDaTabela });
  } catch (error) {
    if (error instanceof DumpError) return abortar(error.message);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return abortar(`arquivo não encontrado: ${(error as NodeJS.ErrnoException).path}`);
    throw error;
  }
  rel.origem.bancos = [...new Set([...dump.tabelas.values()].map((t) => t.banco))].sort();
  rel.origem.tabelas = [...dump.tabelas.keys()].sort();

  // 2. Mapa conferido contra o CREATE TABLE (D3).
  const conf = conferirMapa(dump);
  rel.origem.colunasIgnoradas = conf.colunasIgnoradas;
  rel.origem.colunasOpcionaisAusentes = conf.colunasOpcionaisAusentes;
  rel.origem.tabelasForaDoMapa = conf.tabelasForaDoMapa;
  if (conf.erros.length) return abortar(`o dump não bate com o mapa de colunas (src/lib/migracao/mapa.ts): ${conf.erros.join("; ")}`);
  for (const t of conf.tabelasAusentes) rel.avisos.push({ tipo: "tabela_ausente", tabela: t, idLegado: null, detalhe: `${t} ausente do dump; não carregada` });

  const anexos = new ImportadorAnexos(op.anexos, simular);
  rel.anexos.pasta = op.anexos ? resolve(op.anexos) : null;
  try {
    await anexos.indexar();
  } catch (error) {
    return abortar((error as Error).message);
  }

  // 3. Proteções da carga real (D10).
  if (!simular) {
    const anteriores = await db.migracaoExecucao.count({
      where: { simulacao: false, situacao: { in: ["concluida", "concluida_com_rejeicoes"] } },
    });
    if (anteriores === 0) {
      const [c, p, f] = await Promise.all([db.contrato.count(), db.pagamento.count(), db.fiscal.count()]);
      if (c + p + f > 0) return abortar(MSG_DADOS_DO_APP);
    }
    const recentes = await db.session.count({ where: { createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } } });
    if (recentes > 0) return abortar(MSG_APP_EM_USO);
    const dir = resolve(op.dirBackups ?? process.env.BACKUP_DIR ?? "data/backups");
    // VACUUM INTO não sobrescreve: duas cargas no mesmo segundo ganham sufixo.
    let backup = join(dir, `pre-migracao-${carimbo(inicio)}.db`);
    for (let i = 2; existsSync(backup); i++) backup = join(dir, `pre-migracao-${carimbo(inicio)}-${i}.db`);
    try {
      await mkdir(dir, { recursive: true });
      await db.$executeRaw`VACUUM INTO ${backup}`;
    } catch (error) {
      return abortar(`backup do banco falhou (${(error as Error).message}); nada foi gravado`);
    }
    rel.backup = backup;
  }

  // 4. Carga numa transação única (D4); simulação desfeita por erro sentinela (D9).
  const origemSha256 = rel.origem.arquivos.map((a) => a.sha256).join(",");
  execucaoId = (await db.migracaoExecucao.create({ data: { simulacao: simular, situacao: "em_andamento", origemSha256 } })).id;
  const parcial = JSON.stringify(rel);
  try {
    await db.$transaction(
      async (tx) => {
        await new Carga(tx, dump, rel, anexos, op).executar();
        if (simular) throw new FimDaSimulacao();
      },
      { timeout: TIMEOUT_TRANSACAO, maxWait: 60_000 },
    );
  } catch (error) {
    if (!(error instanceof FimDaSimulacao)) {
      await anexos.desfazer();
      // Nada ficou gravado: o relatório volta ao estado anterior à transação, com o erro.
      Object.assign(rel, JSON.parse(parcial), { backup: rel.backup });
      return abortar(`carga desfeita, nenhuma linha gravada: ${(error as Error).message}`);
    }
  }
  rel.anexos.gravados = anexos.gravados.length;
  const codigo: 0 | 2 = rel.rejeitados.length ? 2 : 0;

  // 5. Resolvedor de gestores da 022 depois da carga real (D10).
  if (!simular && op.resolvedor !== false) {
    const script = resolve(op.resolvedor ?? "scripts/resolver-cpf-gestores.mjs");
    const r = spawnSync(process.execPath, [script], { env: process.env, encoding: "utf8" });
    rel.resolvedorGestores = { codigo: r.status, saida: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
  }
  return terminar(codigo, codigo === 2 ? "concluida_com_rejeicoes" : "concluida");
}
