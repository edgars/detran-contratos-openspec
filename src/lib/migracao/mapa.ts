import type { Dump } from "./dump-parser";
import { chaveTabela } from "./dump-parser";

/**
 * Mapa de colunas legado → modelo atual (025-migracao-legado, design.md D3 e D4).
 *
 * Regra de nomes (exceções explícitas abaixo): tabela de origem = `@@map` do modelo; coluna de
 * origem no banco `contratos` = camelCase → snake_case (`numeroProcesso` → `numero_processo`); no
 * banco `global` = primeira letra maiúscula (`deNome` → `DeNome`). Exceções: `fiscais.pessoaFisicaCpf`
 * ← `pessoa_fisica_CPF`; `pessoas_fisicas.cpf` ← `CPF`; `prestadores_servicos.cnpj` ← `CNPJ`;
 * chave primária `id` do legado (CakePHP) mantida como `id` também no `global`; `users.password`
 * descartado no parser (nenhuma coluna de destino).
 *
 * Quando o dump real chegar, a primeira simulação lista onde este mapa diverge do `CREATE TABLE`
 * (conferência em `conferirMapa`); o ajuste é editar este arquivo e `tests/migracao-mapa.test.ts`.
 */

export type Banco = "contratos" | "global";

export type Conversor =
  | "id" // inteiro da chave do legado, preservado
  | "inteiro"
  | "texto"
  | "data"
  | "dataHora"
  | "dinheiro"
  | "cpf"
  | "cnpj"
  | "simNao"
  | "zeroUm"
  | "zeroUmTexto"
  | "anexo" // arquivo do servidor antigo → savePdf() (D6)
  | "usuario" // id de usuário do legado → id do usuário migrado (D7)
  | "fornecedor" // CNPJ do fornecedor → prestadores_servicos.id (D5)
  | "legado"; // lida só para o relatório/mapa interno, sem coluna de destino

export type ColunaMapa = {
  /** Campo do modelo Prisma (ou nome interno, para `legado`). */
  destino: string;
  /** Coluna no `CREATE TABLE` do legado. */
  origem: string;
  conv: Conversor;
  /** A coluna pode faltar no dump (vira `null`, listada em `colunasOpcionaisAusentes`). */
  opcional?: boolean;
};

export type Modelo =
  | "diretoria"
  | "departamento"
  | "pessoaFisica"
  | "prestadorServico"
  | "pessoa"
  | "tipoContrato"
  | "modalidade"
  | "situacaoContratual"
  | "status"
  | "fase"
  | "group"
  | "groupUser"
  | "user"
  | "contrato"
  | "contratoStatus"
  | "fiscal"
  | "pagamento"
  | "pagamentoArquivo"
  | "historico"
  | "prestacaoConta"
  | "penalidade"
  | "anexoFiscal"
  | "anexoPublicacao";

export type TabelaMapa = {
  /** Ordem de carga (D4). */
  ordem: number;
  /** Nome da tabela de destino (`@@map`). */
  destino: string;
  /** Nome do modelo no Prisma Client (`tx[modelo]`) e no `Prisma.dmmf`. */
  modelo: Modelo;
  banco: Banco;
  origem: string;
  /** Chave de idempotência no destino. */
  chave: "id" | "cpf" | "cnpj" | "username";
  /** Tabela que precisa existir no dump (ausente → fatal); as demais ausentes viram aviso. */
  obrigatoria?: boolean;
  colunas: ColunaMapa[];
};

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Coluna pela regra de nomes do banco; `origem` explícita é exceção. */
function col(banco: Banco, destino: string, conv: Conversor, extra: Partial<ColunaMapa> = {}): ColunaMapa {
  const origem = extra.origem ?? (destino === "id" ? "id" : banco === "contratos" ? snake(destino) : pascal(destino));
  return { destino, origem, conv, ...extra };
}

type Def = [destino: string, conv: Conversor, extra?: Partial<ColunaMapa>];

function tabela(ordem: number, banco: Banco, destino: string, modelo: Modelo, chave: TabelaMapa["chave"], defs: Def[], extra: Partial<TabelaMapa> = {}): TabelaMapa {
  return { ordem, destino, modelo, banco, origem: destino, chave, colunas: defs.map(([d, c, e]) => col(banco, d, c, e)), ...extra };
}

const opc = { opcional: true } as const;

/** Colunas de `pessoas_fisicas` (~59 no legado): só as que a carga usa são exigidas; as demais são opcionais. */
const PESSOA_FISICA: Def[] = [
  ["idPessoaFisica", "inteiro"],
  ["cpf", "cpf", { origem: "CPF" }],
  ["deNome", "texto"],
  ["dtNascimento", "data"],
  ["dtExcluido", "dataHora"],
  ...(
    [
      ["deEndereco", "texto"],
      ["deBairro", "texto"],
      ["deTelefone", "texto"],
      ["deNomePai", "texto"],
      ["deNomeMae", "texto"],
      ["deNaturalidade", "texto"],
      ["deUrlFoto", "texto"],
      ["prestadorServico", "texto"],
      ["cep", "texto"],
      ["pseudonimo", "texto"],
      ["nuExtraQuadro", "texto"],
      ["nuRegistro", "texto"],
      ["nuMatricula", "texto"],
      ["identidadeFuncional", "texto"],
      ["vinculo", "inteiro"],
      ["flTermoImpresso", "texto"],
      ["flFuncionarioPublico", "texto"],
      ["flConformidadeTermo", "texto"],
      ["flEmitirCracha", "texto"],
      ["flAprovado", "texto"],
      ["flAposentado", "inteiro"],
      ["dtInclusaoTermo", "dataHora"],
      ["dtTermoRecebido", "dataHora"],
      ["dtTermoPreAprovado", "dataHora"],
      ["dtCracha", "dataHora"],
      ["dtCorregedoria", "dataHora"],
      ["dtInformatica", "dataHora"],
      ["dtUltimaAlteracaoTermo", "dataHora"],
      ["foto", "texto"],
      ["municipioId", "inteiro"],
      ["cargoId", "inteiro"],
      ["tipoSanguineoId", "inteiro"],
      ["departamentoId", "inteiro"],
      ["lotacaoId", "inteiro"],
      ["lotacaoOrigemId", "inteiro"],
      ["ufId", "texto"],
      ["orgaoExpedidorId", "inteiro"],
      ["origemExternaId", "inteiro"],
      ["nacionalidadeId", "inteiro"],
      ["guiaRemessaId", "inteiro"],
      ["guiaRemessaCrachaId", "inteiro"],
      ["usuarioCorregedoriaId", "inteiro"],
      ["usuarioDpId", "inteiro"],
      ["flAlteracao", "inteiro"],
      ["deObservacao", "texto"],
      ["deSimbolo", "texto"],
      ["dtPublicDoerj", "data"],
      ["dtValidade", "data"],
      ["dtNomeacao", "data"],
      ["dtPosse", "data"],
      ["dtExercicio", "data"],
      ["flPublicadoDoerj", "texto"],
      ["dtPublicDoerjN", "data"],
      ["lotacaoCgpId", "inteiro"],
    ] as [string, Conversor][]
  ).map(([d, c]): Def => [d, c, opc]),
];

export const MAPA: readonly TabelaMapa[] = [
  tabela(1, "global", "diretorias", "diretoria", "id", [
    ["id", "id"],
    ["deDiretoria", "texto"],
    ["codigo", "texto"],
  ]),
  tabela(2, "global", "departamentos", "departamento", "id", [
    ["id", "id"],
    ["deDepartamento", "texto"],
    ["codigo", "texto"],
    ["deLogradouro", "texto"],
    ["deComplemento", "texto"],
    ["deBairro", "texto"],
    ["deCidade", "texto"],
    ["cep", "texto"],
    ["diretoriaId", "inteiro"],
    ["municipioId", "inteiro"],
  ]),
  tabela(3, "global", "pessoas_fisicas", "pessoaFisica", "cpf", PESSOA_FISICA),
  tabela(4, "global", "prestadores_servicos", "prestadorServico", "cnpj", [
    ["deRazaoSocial", "texto"],
    ["cnpj", "cnpj", { origem: "CNPJ" }],
  ]),
  tabela(
    5,
    "global",
    "pessoas",
    "pessoa",
    "id",
    [
      ["id", "id"],
      ["cpf", "cpf", { origem: "CPF" }],
      ["cnpj", "cnpj", { origem: "CNPJ" }],
    ],
  ),
  tabela(6, "contratos", "tipo_contrato", "tipoContrato", "id", [
    ["id", "id"],
    ["nome", "texto"],
    ["gerenciamento", "simNao"],
    ["indicativoMetaRisco", "simNao"],
  ]),
  tabela(7, "contratos", "modalidades", "modalidade", "id", [
    ["id", "id"],
    ["nome", "texto"],
  ]),
  tabela(8, "contratos", "situacao_contratual", "situacaoContratual", "id", [
    ["id", "id"],
    ["descricao", "texto"],
  ]),
  tabela(9, "contratos", "status", "status", "id", [
    ["id", "id"],
    ["nome", "texto"],
    ["fluxo", "texto"],
    ["periodo", "inteiro"],
  ]),
  tabela(10, "contratos", "fases", "fase", "id", [
    ["id", "id"],
    ["nome", "texto"],
    ["periodo", "texto"],
  ]),
  tabela(11, "contratos", "groups", "group", "id", [
    ["id", "id"],
    ["name", "texto"],
    ["created", "dataHora"],
    ["modified", "dataHora"],
    ["acoId", "inteiro"],
    ["descricao", "texto"],
  ]),
  tabela(12, "contratos", "users", "user", "username", [
    ["idLegado", "legado", { origem: "id" }],
    ["username", "texto"],
    ["created", "dataHora"],
    ["modified", "dataHora"],
    ["pessoaId", "inteiro"],
    ["superuser", "zeroUm"],
    ["ultimoLogin", "dataHora"],
    // `inativo` do legado só vai para o relatório (todo migrado entra inativo, D7).
    ["inativoLegado", "legado", { origem: "inativo", opcional: true }],
  ]),
  // Depois de `users`: `groups_users.userId` aponta para o id do usuário migrado (mesma ligação da migração 023).
  tabela(13, "contratos", "groups_users", "groupUser", "id", [
    ["id", "id"],
    ["groupId", "inteiro"],
    ["userId", "usuario"],
    ["acoId", "inteiro"],
  ]),
  tabela(
    14,
    "contratos",
    "contratos",
    "contrato",
    "id",
    [
      ["id", "id"],
      ["numeroProcesso", "texto"],
      ["numeroContrato", "texto"],
      ["periodo", "texto"],
      ["parentId", "inteiro"],
      ["dataInclusao", "data"],
      ["dataInicio", "data"],
      ["dataTermino", "data"],
      ["valorInicial", "dinheiro"],
      ["valorMensal", "dinheiro"],
      ["valorTotal", "dinheiro"],
      ["departamentoId", "inteiro"],
      ["pessoaFisicaId", "cpf"],
      ["suplenteId", "cpf"],
      ["prestadorServicoId", "fornecedor"],
      ["tipoContratoId", "inteiro"],
      ["modalidadeId", "inteiro"],
      ["situacaoContratualId", "inteiro"],
      ["objeto", "texto"],
      ["anexoTipo", "texto"],
      ["anexo", "anexo"],
      ["projetoBasico", "anexo"],
      ["numeroModalidade", "texto"],
      ["naPresidencia", "zeroUm"],
      ["prestacaoRealizada", "zeroUmTexto"],
      ["numeroFiscais", "texto"],
    ],
    { obrigatoria: true },
  ),
  tabela(15, "contratos", "contrato_status", "contratoStatus", "id", [
    ["id", "id"],
    ["contratoId", "inteiro"],
    ["statusId", "inteiro"],
    ["dataInclusao", "dataHora"],
    ["descricao", "texto"],
    ["usuarioId", "usuario"],
    ["atendido", "zeroUm"],
    ["aditivoId", "inteiro"],
  ]),
  tabela(16, "contratos", "fiscais", "fiscal", "id", [
    ["id", "id"],
    ["contratoId", "inteiro"],
    ["pessoaFisicaCpf", "cpf", { origem: "pessoa_fisica_CPF" }],
    ["suplente", "simNao"],
    ["dataInclusao", "dataHora"],
    ["presidente", "simNao"],
  ]),
  tabela(17, "contratos", "pagamentos", "pagamento", "id", [
    ["id", "id"],
    ["competencia", "data"],
    ["numeroProcesso", "texto"],
    ["contratoId", "inteiro"],
    ["valor", "dinheiro"],
    ["empenho", "texto"],
    ["notaFiscal", "texto"],
    ["notaLiquidacao", "texto"],
    ["ordemBancaria", "texto"],
    ["glosa", "texto"],
    ["valorGlosa", "dinheiro"],
    ["mes", "texto"],
    ["ano", "texto"],
  ]),
  tabela(18, "contratos", "pagamento_arquivos", "pagamentoArquivo", "id", [
    ["id", "id"],
    ["arquivo", "anexo"],
    ["pagamentoId", "inteiro"],
  ]),
  tabela(19, "contratos", "historicos", "historico", "id", [
    ["id", "id"],
    ["contratoId", "inteiro"],
    ["dataInclusao", "dataHora"],
    ["descricao", "texto"],
    ["usuarioId", "usuario"],
  ]),
  tabela(20, "contratos", "prestacao_contas", "prestacaoConta", "id", [
    ["id", "id"],
    ["descricao", "texto"],
    ["atendido", "simNao"],
    ["dataInclusao", "dataHora"],
    ["faseId", "inteiro"],
    ["userId", "usuario"],
    ["contratoId", "inteiro"],
  ]),
  tabela(21, "contratos", "penalidades", "penalidade", "id", [
    ["id", "id"],
    ["dataRegistro", "data"],
    ["arquivo", "anexo"],
    ["contratoId", "inteiro"],
    ["userId", "usuario"],
  ]),
  tabela(22, "contratos", "anexos_fiscais", "anexoFiscal", "id", [
    ["id", "id"],
    ["anexo", "anexo"],
    ["dataRegistro", "data"],
    ["contratoId", "inteiro"],
  ]),
  tabela(23, "contratos", "anexos_publicacao", "anexoPublicacao", "id", [
    ["id", "id"],
    ["anexo", "anexo"],
    ["contratoId", "inteiro"],
    ["dataPublicacao", "data"],
  ]),
];

/** Colunas do legado lidas e descartadas no parser (nunca vão para memória, relatório, log ou banco). */
export const COLUNAS_DESCARTADAS: ReadonlySet<string> = new Set(["contratos.users.password"]);

/** Colunas conhecidas e não carregadas de propósito (não entram em `colunasIgnoradas`). */
const CONHECIDAS_SEM_DESTINO: ReadonlySet<string> = new Set(["contratos.users.password"]);

/** Bancos do mapa que têm a tabela dada (para arquivo sem `USE`). */
export function bancosDaTabela(tabela: string): string[] {
  return [...new Set(MAPA.filter((t) => t.origem === tabela).map((t) => t.banco))];
}

export type Conferencia = {
  /** Erros fatais: `banco.tabela.coluna` esperadas e ausentes, com as colunas encontradas. */
  erros: string[];
  /** Colunas do dump (das tabelas do mapa) que o mapa não usa, para revisão humana. */
  colunasIgnoradas: string[];
  /** Colunas opcionais do mapa ausentes do dump (carregadas como `null`). */
  colunasOpcionaisAusentes: string[];
  /** Tabelas opcionais ausentes do dump. */
  tabelasAusentes: string[];
  /** Tabelas do dump fora do mapa (não carregadas). */
  tabelasForaDoMapa: string[];
};

/**
 * Confere o mapa contra o `CREATE TABLE` do dump (D3), antes de gravar qualquer linha: coluna
 * exigida ausente ou tabela obrigatória ausente → erro fatal; colunas a mais → `colunasIgnoradas`.
 */
export function conferirMapa(dump: Dump): Conferencia {
  const out: Conferencia = { erros: [], colunasIgnoradas: [], colunasOpcionaisAusentes: [], tabelasAusentes: [], tabelasForaDoMapa: [] };
  for (const t of MAPA) {
    const nome = chaveTabela(t.banco, t.origem);
    const dt = dump.tabelas.get(nome);
    if (!dt) {
      if (t.obrigatoria) out.erros.push(`tabela obrigatória ausente: ${nome} (tabelas encontradas: ${[...dump.tabelas.keys()].join(", ") || "nenhuma"})`);
      else out.tabelasAusentes.push(nome);
      continue;
    }
    const existentes = new Set(dt.colunas.map((c) => c.nome));
    const faltando = t.colunas.filter((c) => !existentes.has(c.origem));
    const exigidas = faltando.filter((c) => !c.opcional);
    if (exigidas.length) {
      out.erros.push(
        `${exigidas.map((c) => `${nome}.${c.origem}`).join(", ")} ausente(s) no dump; colunas encontradas em ${nome}: ${dt.colunas.map((c) => c.nome).join(", ")}`,
      );
    }
    for (const c of faltando.filter((c) => c.opcional)) out.colunasOpcionaisAusentes.push(`${nome}.${c.origem}`);
    const usadas = new Set(t.colunas.map((c) => c.origem));
    for (const c of dt.colunas) {
      const chave = `${nome}.${c.nome}`;
      if (!usadas.has(c.nome) && !CONHECIDAS_SEM_DESTINO.has(chave)) out.colunasIgnoradas.push(chave);
    }
  }
  const doMapa = new Set(MAPA.map((t) => chaveTabela(t.banco, t.origem)));
  for (const k of dump.tabelas.keys()) if (!doMapa.has(k)) out.tabelasForaDoMapa.push(k);
  return out;
}
