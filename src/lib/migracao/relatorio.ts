import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Relatório de conferência da carga do legado (025-migracao-legado, design.md D8). Nunca contém
 * `password`, `passwordHash` nem valor de senha: a senha do legado é descartada no parser.
 */

export type TipoAviso =
  | "cpf_sem_pessoa"
  | "cnpj_sem_fornecedor"
  | "dv_invalido"
  | "cpf_duplicado"
  | "cnpj_duplicado"
  | "anexo_ausente"
  | "anexo_invalido"
  | "anexo_ambiguo"
  | "anexo_nao_importado"
  | "texto_acima_do_limite"
  | "autor_desconhecido"
  | "pendencia_cadastro"
  | "referencia_inexistente"
  | "tabela_ausente";

export type Aviso = { tipo: TipoAviso; tabela: string; idLegado: string | null; detalhe: string };
export type Rejeitado = { tabela: string; idLegado: string | null; motivo: string };
export type Arredondamento = { tabela: string; id: string | null; coluna: string; origem: string; gravado: string };

export type ContagemTabela = {
  destino: string;
  origem: string;
  lidas: number;
  inseridas: number;
  atualizadas: number;
  inalteradas: number;
  rejeitadas: number;
  naoCarregadas: number;
};

export type Somatorio = { campo: string; origem: string; origemArredondada: string; destino: string; diferenca: string };

export type Relatorio = {
  execucao: { id: number | null; inicio: string; fim: string | null; simulacao: boolean; situacao: string; codigoSaida: number };
  origem: {
    arquivos: { arquivo: string; sha256: string }[];
    bancos: string[];
    tabelas: string[];
    colunasIgnoradas: string[];
    colunasOpcionaisAusentes: string[];
    tabelasForaDoMapa: string[];
  };
  anexos: { pasta: string | null; gravados: number };
  tabelas: ContagemTabela[];
  somatorios: Somatorio[];
  arredondamentos: Arredondamento[];
  rejeitados: Rejeitado[];
  avisos: Aviso[];
  existentesForaDoDump: { tabela: string; chave: string }[];
  usuarios: {
    criados: string[];
    existentes: string[];
    precisamDeSenha: string[];
    gruposSemMapeamento: string[];
    usuariosInativosNoLegado: string[];
    perfisAtribuidos: Record<string, number>;
    usuarioTecnico: string | null;
  };
  contratosSemValorInicial: number;
  backup: string | null;
  resolvedorGestores: { codigo: number | null; saida: string } | null;
  erros: string[];
};

export function relatorioVazio(simulacao: boolean, inicio: Date): Relatorio {
  return {
    execucao: { id: null, inicio: inicio.toISOString(), fim: null, simulacao, situacao: "em_andamento", codigoSaida: 1 },
    origem: { arquivos: [], bancos: [], tabelas: [], colunasIgnoradas: [], colunasOpcionaisAusentes: [], tabelasForaDoMapa: [] },
    anexos: { pasta: null, gravados: 0 },
    tabelas: [],
    somatorios: [],
    arredondamentos: [],
    rejeitados: [],
    avisos: [],
    existentesForaDoDump: [],
    usuarios: {
      criados: [],
      existentes: [],
      precisamDeSenha: [],
      gruposSemMapeamento: [],
      usuariosInativosNoLegado: [],
      perfisAtribuidos: {},
      usuarioTecnico: null,
    },
    contratosSemValorInicial: 0,
    backup: null,
    resolvedorGestores: null,
    erros: [],
  };
}

type ContratoCarregado = {
  tipoContratoId?: unknown;
  numeroProcesso?: unknown;
  numeroContrato?: unknown;
  dataInicio?: unknown;
  dataTermino?: unknown;
  departamentoId?: unknown;
  prestadorServicoId?: unknown;
};

const falta = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/**
 * Pendências de cadastro (D8): o contrato do legado é gravado mesmo sem um campo que o formulário
 * exige; cada falta vira aviso `pendencia_cadastro` com a chave da regra, que volta a valer na
 * próxima edição pelo app.
 */
export function pendenciasCadastro(c: ContratoCarregado): { rk: string; campo: string }[] {
  const out: { rk: string; campo: string }[] = [];
  // RK-79134600b4be — Informe o tipo de contrato
  if (falta(c.tipoContratoId)) out.push({ rk: "RK-79134600b4be", campo: "tipoContratoId" });
  // RK-776d8b62d6df — Informe o número do processo
  if (falta(c.numeroProcesso)) out.push({ rk: "RK-776d8b62d6df", campo: "numeroProcesso" });
  // RK-04fd1cbfc346 — Informe o número do contrato
  if (falta(c.numeroContrato)) out.push({ rk: "RK-04fd1cbfc346", campo: "numeroContrato" });
  // RK-6b2806cfff8d — Informe a data de início
  if (falta(c.dataInicio)) out.push({ rk: "RK-6b2806cfff8d", campo: "dataInicio" });
  // RK-9d6599f5897d — Informe a data de vencimento
  if (falta(c.dataTermino)) out.push({ rk: "RK-9d6599f5897d", campo: "dataTermino" });
  // RK-a0660a4fb262 — Informe o departamento (unidade gestora)
  if (falta(c.departamentoId)) out.push({ rk: "RK-a0660a4fb262", campo: "departamentoId" });
  // RK-37f294a3dc8e — Informe o fornecedor
  if (falta(c.prestadorServicoId)) out.push({ rk: "RK-37f294a3dc8e", campo: "prestadorServicoId" });
  return out;
}

/** Confere a invariante de D8 em cada tabela: lidas = inseridas + atualizadas + inalteradas + rejeitadas + não carregadas. */
export function contagensFecham(r: Pick<Relatorio, "tabelas">): string[] {
  return r.tabelas
    .filter((t) => t.lidas !== t.inseridas + t.atualizadas + t.inalteradas + t.rejeitadas + t.naoCarregadas)
    .map((t) => t.destino);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `AAAAMMDD-HHMMSS` no relógio do servidor (nomes de relatório e de backup). */
export function carimbo(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function caminhoRelatorio(opcoes: { relatorio?: string; dirRelatorios?: string; simular?: boolean }, inicio: Date): string {
  if (opcoes.relatorio) return resolve(opcoes.relatorio);
  return resolve(join(opcoes.dirRelatorios ?? "data/migracao", `relatorio-${carimbo(inicio)}${opcoes.simular ? "-simulacao" : ""}.json`));
}

export async function gravarRelatorio(caminho: string, r: Relatorio): Promise<void> {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, `${JSON.stringify(r, null, 2)}\n`, "utf8");
}

const col = (s: string | number, n: number, direita = false) => (direita ? String(s).padStart(n) : String(s).padEnd(n));

/** Resumo em tabela para o terminal. */
export function resumo(r: Relatorio, arquivo: string | null): string {
  const linhas: string[] = [];
  const e = r.execucao;
  linhas.push(`Carga do legado ${e.simulacao ? "(SIMULAÇÃO: nada foi gravado)" : "(carga real)"} — ${e.situacao}, código de saída ${e.codigoSaida}`);
  for (const erro of r.erros) linhas.push(`ERRO: ${erro}`);
  if (r.tabelas.length) {
    linhas.push("");
    linhas.push(
      `${col("tabela", 22)} ${col("lidas", 7, true)} ${col("inseridas", 9, true)} ${col("atualiz.", 8, true)} ${col("inalter.", 8, true)} ${col("rejeit.", 7, true)} ${col("não carr.", 9, true)}`,
    );
    for (const t of r.tabelas) {
      linhas.push(
        `${col(t.destino, 22)} ${col(t.lidas, 7, true)} ${col(t.inseridas, 9, true)} ${col(t.atualizadas, 8, true)} ${col(t.inalteradas, 8, true)} ${col(t.rejeitadas, 7, true)} ${col(t.naoCarregadas, 9, true)}`,
      );
    }
  }
  if (r.somatorios.length) {
    linhas.push("");
    linhas.push(`${col("somatório", 24)} ${col("origem", 16, true)} ${col("orig. arred.", 16, true)} ${col("destino", 16, true)} ${col("diferença", 10, true)}`);
    for (const s of r.somatorios) {
      linhas.push(`${col(s.campo, 24)} ${col(s.origem, 16, true)} ${col(s.origemArredondada, 16, true)} ${col(s.destino, 16, true)} ${col(s.diferenca, 10, true)}`);
    }
  }
  if (r.tabelas.length) {
    linhas.push("");
    const porTipo = new Map<string, number>();
    for (const a of r.avisos) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);
    linhas.push(`arredondamentos: ${r.arredondamentos.length}; rejeitados: ${r.rejeitados.length}; avisos: ${r.avisos.length}${porTipo.size ? ` (${[...porTipo].map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`);
    for (const x of r.rejeitados.slice(0, 20)) linhas.push(`  rejeitado ${x.tabela} ${x.idLegado ?? "?"}: ${x.motivo}`);
    if (r.rejeitados.length > 20) linhas.push(`  … mais ${r.rejeitados.length - 20} no relatório`);
    linhas.push(
      `usuários: ${r.usuarios.criados.length} criados (inativos, sem senha), ${r.usuarios.existentes.length} já existentes; grupos sem mapeamento: ${r.usuarios.gruposSemMapeamento.join(", ") || "nenhum"}`,
    );
    linhas.push(`contratos originais sem valor inicial: ${r.contratosSemValorInicial}; colunas do dump não usadas: ${r.origem.colunasIgnoradas.length}; existentes fora do dump: ${r.existentesForaDoDump.length}`);
    if (r.backup) linhas.push(`backup: ${r.backup}`);
  }
  if (arquivo) linhas.push(`relatório: ${arquivo}`);
  return linhas.join("\n");
}
