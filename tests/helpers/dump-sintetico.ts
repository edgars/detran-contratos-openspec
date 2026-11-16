import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { migrationNames, tempDb } from "./temp-db";

/**
 * Dump sintético do legado (025-migracao-legado, design.md D12): gera, dentro do teste, `contratos.sql`
 * e `global.sql` no formato do `mysqldump` (comentários, `CREATE DATABASE`/`USE`, `DROP`, `CREATE TABLE`,
 * `LOCK TABLES`, `ALTER … KEYS`, INSERT estendido, strings com `\'`, `\\` e `\n`, `NULL`, `0000-00-00`)
 * e uma pasta de anexos com PDFs, um PNG renomeado para `.pdf` e um nome referenciado que não existe.
 *
 * Casos do conjunto padrão (`dadosPadrao`): aditivo 20 listado antes do original 10; aditivo órfão 12
 * (pai 77); CNPJ com máscara; CPF numérico sem zero à esquerda; CPF duplicado no global (um com
 * DtExcluido); `1234.565` e `0.1000000015`; usuário em ContratoCGCL e outro em grupo desconhecido;
 * penalidade de autor inexistente; pagamento de contrato inexistente; competência `0000-00-00`.
 * `ajustar` muda qualquer tabela antes de escrever.
 */

export type Celula = string | number | null | { raw: string };
export type TabelaSintetica = { colunas: string[]; linhas: Celula[][]; pk?: string };
export type Banco = Record<string, TabelaSintetica>;
export type DadosSinteticos = { contratos: Banco; global: Banco };

/** Linha montada por nome de coluna (coluna ausente → NULL). */
export function linha(t: TabelaSintetica, valores: Record<string, Celula>): Celula[] {
  for (const k of Object.keys(valores)) if (!t.colunas.includes(k)) throw new Error(`coluna ${k} não existe`);
  return t.colunas.map((c) => (c in valores ? valores[c] : null));
}

/** Acrescenta linhas por nome de coluna. */
export function inserir(t: TabelaSintetica, ...linhas: Record<string, Celula>[]) {
  for (const l of linhas) t.linhas.push(linha(t, l));
}

/** Troca valores da linha cujo `id` (ou pk) é o dado. */
export function alterar(t: TabelaSintetica, id: Celula, valores: Record<string, Celula>) {
  const pk = t.colunas.indexOf(t.pk ?? "id");
  const l = t.linhas.find((x) => String(x[pk]) === String(id));
  if (!l) throw new Error(`linha ${id} não existe`);
  for (const [k, v] of Object.entries(valores)) l[t.colunas.indexOf(k)] = v;
}

export function remover(t: TabelaSintetica, ...ids: Celula[]) {
  const pk = t.colunas.indexOf(t.pk ?? "id");
  t.linhas = t.linhas.filter((x) => !ids.map(String).includes(String(x[pk])));
}

const tabela = (colunas: string[], pk = "id"): TabelaSintetica => ({ colunas, linhas: [], pk });

export const OBJETO_OBRIEN = "O'Brien\nRJ";
export const SENHA_JOAO = "segredo123";
export const HASH_LEGADO = "HASHLEGADO123";

export function dadosPadrao(): DadosSinteticos {
  const g: Banco = {
    diretorias: tabela(["id", "DeDiretoria", "Codigo"]),
    departamentos: tabela(["id", "DeDepartamento", "Codigo", "DeLogradouro", "DeComplemento", "DeBairro", "DeCidade", "Cep", "DiretoriaId", "MunicipioId"]),
    pessoas_fisicas: tabela(["IdPessoaFisica", "CPF", "DeNome", "DtNascimento", "DtExcluido", "DeEndereco", "Vinculo"], "IdPessoaFisica"),
    prestadores_servicos: tabela(["IdPrestadorServico", "CNPJ", "DeRazaoSocial"], "IdPrestadorServico"),
    pessoas: tabela(["id", "CPF", "CNPJ"]),
  };
  inserir(g.diretorias, { id: 1, DeDiretoria: "Diretoria de Administração", Codigo: "DA" }, { id: 2, DeDiretoria: "Presidência", Codigo: "PR" });
  inserir(
    g.departamentos,
    { id: 10, DeDepartamento: "Coordenação de Contratos", Codigo: "CGCL", DeCidade: "Rio de Janeiro", Cep: "20000000", DiretoriaId: 1 },
    { id: 11, DeDepartamento: "Financeiro", Codigo: "FIN", DiretoriaId: 1 },
    { id: 12, DeDepartamento: "Gabinete", Codigo: "GAB", DiretoriaId: 2 },
  );
  inserir(
    g.pessoas_fisicas,
    { IdPessoaFisica: 1001, CPF: "52998224725", DeNome: "Maria Gestora", DtNascimento: "1980-05-10", DeEndereco: "Rua A, 1", Vinculo: 1 },
    // CPF numérico sem zero à esquerda (coluna numérica no global).
    { IdPessoaFisica: 1002, CPF: 1234567890, DeNome: "José Zero", DtNascimento: "1975-01-01" },
    // CPF duplicado: a linha excluída perde para a ativa.
    { IdPessoaFisica: 1003, CPF: "39053344705", DeNome: "Ana Antiga", DtNascimento: "1970-01-01", DtExcluido: "2015-01-01 00:00:00" },
    { IdPessoaFisica: 1004, CPF: "390.533.447-05", DeNome: "Ana Atual", DtNascimento: "1971-02-02" },
    { IdPessoaFisica: 1005, CPF: null, DeNome: "Sem CPF", DtNascimento: "1990-01-01" },
  );
  inserir(
    g.prestadores_servicos,
    { IdPrestadorServico: 1, CNPJ: "12.345.678/0001-90", DeRazaoSocial: "Fornecedor Um Ltda" },
    { IdPrestadorServico: 2, CNPJ: "11222333000181", DeRazaoSocial: "Fornecedor Dois S/A" },
  );
  inserir(g.pessoas, { id: 1, CPF: "52998224725" });

  const c: Banco = {
    tipo_contrato: tabela(["id", "nome", "gerenciamento", "indicativo_meta_risco"]),
    modalidades: tabela(["id", "nome"]),
    situacao_contratual: tabela(["id", "descricao"]),
    status: tabela(["id", "nome", "fluxo", "periodo"]),
    fases: tabela(["id", "nome", "periodo"]),
    groups: tabela(["id", "name", "created", "modified", "aco_id", "descricao"]),
    users: tabela(["id", "username", "password", "pessoa_id", "superuser", "inativo", "ultimo_login", "created", "modified"]),
    groups_users: tabela(["id", "group_id", "user_id", "aco_id"]),
    contratos: tabela([
      "id",
      "numero_processo",
      "numero_contrato",
      "periodo",
      "parent_id",
      "data_inclusao",
      "data_inicio",
      "data_termino",
      "valor_inicial",
      "valor_mensal",
      "valor_total",
      "departamento_id",
      "pessoa_fisica_id",
      "suplente_id",
      "prestador_servico_id",
      "tipo_contrato_id",
      "modalidade_id",
      "situacao_contratual_id",
      "objeto",
      "anexo_tipo",
      "anexo",
      "projeto_basico",
      "numero_modalidade",
      "na_presidencia",
      "prestacao_realizada",
      "numero_fiscais",
    ]),
    contrato_status: tabela(["id", "contrato_id", "status_id", "data_inclusao", "descricao", "usuario_id", "atendido", "aditivo_id"]),
    fiscais: tabela(["id", "contrato_id", "pessoa_fisica_CPF", "suplente", "data_inclusao", "presidente"]),
    pagamentos: tabela([
      "id",
      "competencia",
      "numero_processo",
      "contrato_id",
      "valor",
      "empenho",
      "nota_fiscal",
      "nota_liquidacao",
      "ordem_bancaria",
      "glosa",
      "valor_glosa",
      "mes",
      "ano",
    ]),
    pagamento_arquivos: tabela(["id", "arquivo", "pagamento_id"]),
    historicos: tabela(["id", "contrato_id", "data_inclusao", "descricao", "usuario_id"]),
    prestacao_contas: tabela(["id", "descricao", "atendido", "data_inclusao", "fase_id", "user_id", "contrato_id"]),
    penalidades: tabela(["id", "data_registro", "arquivo", "contrato_id", "user_id"]),
    anexos_fiscais: tabela(["id", "anexo", "data_registro", "contrato_id"]),
    anexos_publicacao: tabela(["id", "anexo", "contrato_id", "data_publicacao"]),
  };
  inserir(
    c.tipo_contrato,
    { id: 3, nome: "Serviço continuado", gerenciamento: 1, indicativo_meta_risco: 0 },
    { id: 10, nome: "Contrato", gerenciamento: "S", indicativo_meta_risco: "1" },
    { id: 12, nome: "Convênio", gerenciamento: 0, indicativo_meta_risco: 0 },
    { id: 13, nome: "Locação", gerenciamento: 0, indicativo_meta_risco: 1 },
  );
  inserir(c.modalidades, { id: 1, nome: "Pregão" }, { id: 2, nome: "Dispensa" });
  inserir(c.situacao_contratual, { id: 1, descricao: "Vigente" });
  inserir(c.status, { id: 1, nome: "Em análise", fluxo: "S", periodo: 30 }, { id: 2, nome: "Concluído", fluxo: "N", periodo: null });
  inserir(c.fases, { id: 1, nome: "Relatório final", periodo: "30" });
  inserir(
    c.groups,
    { id: 1, name: "ContratoCGCL", created: "2010-01-01 08:00:00" },
    { id: 2, name: "Gestor" },
    { id: 3, name: "Pagamentos" },
    { id: 4, name: "PrestacaoConta" },
    { id: 5, name: "Auditoria" },
  );
  inserir(
    c.users,
    { id: 1, username: "admin", password: HASH_LEGADO, superuser: 1, inativo: 0, created: "2010-01-01 08:00:00" },
    { id: 2, username: "joao", password: SENHA_JOAO, pessoa_id: 1, superuser: 0, inativo: 0, ultimo_login: "2024-06-01 14:30:00" },
    { id: 3, username: "maria", password: HASH_LEGADO, superuser: 0, inativo: 0 },
    { id: 4, username: "pedro", password: HASH_LEGADO, superuser: 0, inativo: 1 },
    { id: 5, username: "carla", password: HASH_LEGADO, superuser: 0, inativo: 0 },
  );
  inserir(
    c.groups_users,
    { id: 1, group_id: 2, user_id: 3 },
    { id: 2, group_id: 3, user_id: 3 },
    { id: 3, group_id: 5, user_id: 4 },
    { id: 4, group_id: 1, user_id: 5 },
    { id: 5, group_id: 2, user_id: 2 },
  );
  const contrato = (v: Record<string, Celula>) => ({
    numero_processo: "E-12/001/2020",
    numero_contrato: "001/2020",
    data_inclusao: "2020-01-02",
    data_inicio: "2020-01-01",
    data_termino: "2030-12-31",
    departamento_id: 10,
    pessoa_fisica_id: "52998224725",
    prestador_servico_id: "11222333000181",
    tipo_contrato_id: 10,
    modalidade_id: 1,
    situacao_contratual_id: 1,
    objeto: "Prestação de serviços",
    na_presidencia: 0,
    prestacao_realizada: 0,
    ...v,
  });
  inserir(
    c.contratos,
    // Aditivo listado antes do original.
    contrato({ id: 20, parent_id: 10, numero_contrato: "001/2020-A1", valor_total: { raw: "500" }, objeto: "Primeiro aditivo" }),
    contrato({
      id: 10,
      objeto: OBJETO_OBRIEN,
      data_inclusao: "0000-00-00",
      valor_inicial: { raw: "1000" },
      valor_mensal: { raw: "2500.5" },
      valor_total: { raw: "0.1000000015" },
      pessoa_fisica_id: "01234567890",
      suplente_id: "39053344705",
      prestador_servico_id: "12345678000190",
      anexo: "uploads/contratos/ct_10.pdf",
      projeto_basico: "PB_10.pdf",
      na_presidencia: 1,
      prestacao_realizada: 1,
    }),
    // Sem número de processo, CNPJ sem fornecedor, original sem valor inicial.
    contrato({ id: 11, numero_processo: null, prestador_servico_id: "99888777000166", valor_total: { raw: "1000.00" }, valor_inicial: null }),
    // Aditivo órfão.
    contrato({ id: 12, parent_id: 77, numero_contrato: "999/2019-A1", valor_total: { raw: "10" } }),
    // Objeto acima do limite da 020 (200).
    contrato({ id: 13, tipo_contrato_id: 3, objeto: "x".repeat(250), valor_total: { raw: "300.00" }, valor_inicial: { raw: "300.00" } }),
  );
  inserir(
    c.contrato_status,
    { id: 1, contrato_id: 10, status_id: 1, data_inclusao: "2020-01-02 10:00:00", descricao: "Em análise", usuario_id: 3, atendido: 1 },
    { id: 2, contrato_id: 10, status_id: null, data_inclusao: "2020-01-03 10:00:00", descricao: "Sem status", usuario_id: 3, atendido: 0 },
  );
  inserir(
    c.fiscais,
    { id: 1, contrato_id: 10, pessoa_fisica_CPF: "529.982.247-25", suplente: 0, data_inclusao: "2020-01-02 10:00:00", presidente: 0 },
    { id: 2, contrato_id: 10, pessoa_fisica_CPF: "11144477735", suplente: 1, presidente: "S" },
  );
  inserir(
    c.pagamentos,
    { id: 1, competencia: "2020-01-01", numero_processo: "P-1", contrato_id: 10, valor: { raw: "1234.565" }, mes: "01", ano: "2020" },
    { id: 2, competencia: "2020-02-01", numero_processo: "P-2", contrato_id: 999, valor: { raw: "10.00" } },
    { id: 3, competencia: "0000-00-00", numero_processo: "P-3", contrato_id: 10, valor: { raw: "5.00" } },
    { id: 4, competencia: "2020-03-01", numero_processo: "P-4", contrato_id: 10, valor: { raw: "100.00" }, glosa: "S", valor_glosa: { raw: "0.333" } },
  );
  inserir(c.pagamento_arquivos, { id: 1, arquivo: "pg_1.pdf", pagamento_id: 1 });
  inserir(
    c.historicos,
    { id: 1, contrato_id: 10, data_inclusao: "2020-01-05 09:00:00", descricao: "Cadastro", usuario_id: 2 },
    { id: 2, contrato_id: 10, data_inclusao: "2020-01-06 09:00:00", descricao: "Autor removido", usuario_id: 88 },
  );
  inserir(c.prestacao_contas, { id: 1, descricao: "Relatório entregue", atendido: 1, data_inclusao: "2021-01-01 00:00:00", fase_id: 1, user_id: 3, contrato_id: 10 });
  inserir(c.penalidades, { id: 1, data_registro: "2021-02-02", arquivo: "pen_1.pdf", contrato_id: 10, user_id: 55 });
  inserir(
    c.anexos_fiscais,
    { id: 1, anexo: "af_1.pdf", data_registro: "2021-03-03", contrato_id: 10 },
    { id: 2, anexo: "nao_existe.pdf", data_registro: "2021-03-04", contrato_id: 10 },
  );
  inserir(
    c.anexos_publicacao,
    { id: 1, anexo: "pub_1.pdf", contrato_id: 10, data_publicacao: "2021-04-04" },
    { id: 2, anexo: "imagem.pdf", contrato_id: 10, data_publicacao: "2021-04-05" },
  );
  return { contratos: c, global: g };
}

/**
 * Variante sem os casos que rejeitam linha (aditivo órfão, andamento sem status, pagamento de contrato
 * inexistente, competência zerada e os anexos obrigatórios): a carga sem `--anexos` termina com código 0.
 */
export function semRejeicoes(d: DadosSinteticos) {
  remover(d.contratos.contratos, 12);
  remover(d.contratos.contrato_status, 2);
  remover(d.contratos.pagamentos, 2, 3);
  d.contratos.pagamento_arquivos.linhas = [];
  d.contratos.anexos_fiscais.linhas = [];
}

/** Acrescenta uma coluna (com o mesmo valor em todas as linhas). */
export function acrescentarColuna(t: TabelaSintetica, coluna: string, valor: Celula) {
  t.colunas.push(coluna);
  for (const l of t.linhas) l.push(valor);
}

/** Renomeia uma coluna (simula divergência entre o mapa e o dump real). */
export function renomearColuna(t: TabelaSintetica, de: string, para: string) {
  const i = t.colunas.indexOf(de);
  if (i < 0) throw new Error(`coluna ${de} não existe`);
  t.colunas[i] = para;
}

/** Escape de string do mysqldump. */
export function escapar(s: string): string {
  return s.replace(/[\\'"\n\r\0\x1a]/g, (ch) => ({ "\\": "\\\\", "'": "\\'", '"': '\\"', "\n": "\\n", "\r": "\\r", "\0": "\\0", "\x1a": "\\Z" })[ch]!);
}

function valorSql(v: Celula): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return v.raw;
  return `'${escapar(v)}'`;
}

function tipoColuna(c: string): string {
  if (/^(id|Id)$|_id$|Id[A-Z]?\w*$|^Id/.test(c) && !/CPF|CNPJ/.test(c)) return "int(11)";
  if (/^valor/.test(c)) return "float";
  if (/data_|^Dt|competencia/.test(c)) return /hora|inclusao|Excluido/.test(c) ? "datetime" : "date";
  if (/created|modified|ultimo_login/.test(c)) return "datetime";
  return "varchar(255)";
}

/** Texto do dump de um banco, no formato do mysqldump 5.6. */
export function textoDump(banco: string, tabelas: Banco, opcoes: { use?: boolean } = {}): string {
  const out: string[] = [
    "-- MySQL dump 10.13  Distrib 5.6.40, for Linux (x86_64)",
    "--",
    `-- Host: legado    Database: ${banco}`,
    "-- ------------------------------------------------------",
    "-- Server version\t5.6.40",
    "",
    "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;",
    "/*!40101 SET NAMES utf8mb4 */;",
    "/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;",
    "",
  ];
  if (opcoes.use !== false) {
    out.push(`CREATE DATABASE /*!32312 IF NOT EXISTS*/ \`${banco}\` /*!40100 DEFAULT CHARACTER SET latin1 */;`, "", `USE \`${banco}\`;`, "");
  }
  for (const [nome, t] of Object.entries(tabelas)) {
    const pk = t.pk ?? "id";
    out.push(
      "--",
      `-- Table structure for table \`${nome}\``,
      "--",
      "",
      `DROP TABLE IF EXISTS \`${nome}\`;`,
      "/*!40101 SET @saved_cs_client     = @@character_set_client */;",
      "/*!40101 SET character_set_client = utf8 */;",
      `CREATE TABLE \`${nome}\` (`,
      ...t.colunas.map((c) => `  \`${c}\` ${tipoColuna(c)}${c === pk ? " NOT NULL AUTO_INCREMENT" : " DEFAULT NULL"},`),
      `  PRIMARY KEY (\`${pk}\`)`,
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8;",
      "/*!40101 SET character_set_client = @saved_cs_client */;",
      "",
      "--",
      `-- Dumping data for table \`${nome}\``,
      "--",
      "",
      `LOCK TABLES \`${nome}\` WRITE;`,
      `/*!40000 ALTER TABLE \`${nome}\` DISABLE KEYS */;`,
    );
    if (t.linhas.length) out.push(`INSERT INTO \`${nome}\` VALUES ${t.linhas.map((l) => `(${l.map(valorSql).join(",")})`).join(",")};`);
    out.push(`/*!40000 ALTER TABLE \`${nome}\` ENABLE KEYS */;`, "UNLOCK TABLES;", "");
  }
  out.push("/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;", "", "-- Dump completed on 2026-11-13 10:00:00", "");
  return out.join("\n");
}

/** Conteúdo de cada arquivo da pasta de anexos padrão (PDFs distintos; `imagem.pdf` é PNG). */
export function arquivosAnexos(): Record<string, Buffer> {
  const pdf = (s: string) => Buffer.from(`%PDF-1.4\n% ${s}\n%%EOF\n`, "latin1");
  return {
    "uploads/contratos/ct_10.pdf": pdf("contrato 10"),
    "projetos/pb_10.pdf": pdf("projeto básico 10"),
    "pagamentos/pg_1.pdf": pdf("pagamento 1"),
    "pen_1.pdf": pdf("penalidade 1"),
    "fiscais/2021/af_1.pdf": pdf("anexo fiscal 1"),
    "pub_1.pdf": pdf("publicação 1"),
    "imagem.pdf": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
  };
}

export type DumpGerado = { dir: string; contratos: string; global: string; anexos: string };

/**
 * Grava `contratos.sql`, `global.sql` e a pasta `anexos/` num diretório temporário novo (ou em `dir`).
 * `ajustar` altera os dados antes de escrever; `use: false` gera arquivos sem `USE`.
 */
export function gerarDumpSintetico(opcoes: { ajustar?: (d: DadosSinteticos) => void; use?: boolean; dir?: string } = {}): DumpGerado {
  const dir = opcoes.dir ?? mkdtempSync(join(tmpdir(), "dump-025-"));
  mkdirSync(dir, { recursive: true });
  const dados = dadosPadrao();
  opcoes.ajustar?.(dados);
  const contratos = join(dir, "contratos.sql");
  const global = join(dir, "global.sql");
  writeFileSync(contratos, textoDump("contratos", dados.contratos, { use: opcoes.use }));
  writeFileSync(global, textoDump("global", dados.global, { use: opcoes.use }));
  const anexos = join(dir, "anexos");
  for (const [rel, bytes] of Object.entries(arquivosAnexos())) {
    mkdirSync(join(anexos, rel, ".."), { recursive: true });
    writeFileSync(join(anexos, rel), bytes);
  }
  return { dir, contratos, global, anexos };
}

/** Arquivos gravados em UPLOAD_DIR (nomes). */
export function arquivosEm(dir: string): string[] {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
}

export function apagar(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Banco SQLite temporário com todas as migrações, só desta suíte de carga: as checagens da carga real
 * exigem banco sem dados do app, o que o banco compartilhado da suíte não garante. Chamar dentro de
 * `vi.hoisted` (antes de `@/lib/db` ser importado): troca `DATABASE_URL` e `UPLOAD_DIR` do processo.
 */
export function prepararBancoMigracao() {
  const db = tempDb("mig-025-");
  db.deploy(migrationNames());
  const uploads = mkdtempSync(join(tmpdir(), "uploads-025-"));
  process.env.DATABASE_URL = db.url;
  process.env.UPLOAD_DIR = uploads;
  delete (globalThis as { prisma?: unknown }).prisma;
  return { url: db.url, uploads, dispose: () => db.dispose().finally(() => apagar(uploads)) };
}

/** Esvazia todas as tabelas (e o autoincremento) e a pasta de anexos entre os testes. */
export async function limparBanco(prisma: PrismaClient, uploads: string) {
  const tabelas = (
    await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_prisma%' AND name <> 'sqlite_sequence'",
    )
  ).map((t) => t.name);
  // Filhas antes das mães (chaves estrangeiras): repete até esvaziar.
  for (let volta = 0; volta < 5 && tabelas.length; volta++) {
    for (const t of [...tabelas]) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`);
        tabelas.splice(tabelas.indexOf(t), 1);
      } catch {
        // tenta de novo na próxima volta
      }
    }
  }
  await prisma.$executeRawUnsafe("DELETE FROM sqlite_sequence");
  apagar(uploads);
  mkdirSync(uploads, { recursive: true });
}
