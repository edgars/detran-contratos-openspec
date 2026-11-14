# Design

## Context

Fonte única do comportamento: docs/legado/relatorios.md (lido do `relatorios_controller.php` pelo MCP
da RNC em 13/11/2026). Todas as consultas do legado usam só contratos originais (`parent_id IS NULL`) e
fazem os joins `PessoaFisica.CPF = Contrato.pessoa_fisica_id`, `PrestadorServico.CNPJ =
Contrato.prestador_servico_id`, `Departamento.id = Contrato.departamento_id`
(docs/legado/chaves-pessoas-fornecedores.md). O legado exporta PDF com TCPDF (`criaPdf`) e Excel
(`criaExcel`).

Estado do app (código atual):

- `prisma/schema.prisma` › `Contrato`: `parentId Int?`, `dataTermino DateTime?` (meia-noite UTC, gravada por `parseDate`), `valorTotal`/`valorInicial Decimal?`, `pessoaFisicaId String?`, `prestadorServicoId Int?` (relação `prestadorServico`), `anexo String?`, `projetoBasico String?`, `naPresidencia Int?`.
- `TipoContrato` já tem `indicativoMetaRisco String @default("N")`, fora do formulário (`src/lib/entities/tipo_contratos.server.ts:23`).
- `PessoaFisica` não tem CPF e `PrestadorServico` não tem CNPJ: `022-pessoas-fornecedores` cria `pessoas_fisicas.cpf` e `prestadores_servicos.cnpj` (11/14 dígitos, sem máscara), passa a gravar o CPF em `contratos.pessoaFisicaId`, mantém o fornecedor como FK por `id` (decisão D3 da 022) e entrega `pessoasPorCpf(cpfs)` em `src/lib/reference/pessoas.ts`.
- `projetoBasico` é textarea e `naPresidencia` não está no formulário: `020-contratos-complementos` faz do projeto básico um PDF (`savePdf`, texto antigo zerado por migração) e grava `naPresidencia` como `1`/`0` (docs/legado/contratos-complementos.md).
- `021-prestacao-contas-fluxo` cria `tipo_contrato.prestacaoContas` (`S`/`N`) no lugar de `PrestacaoConta::tiposContratos`.
- Navegação em `src/lib/navigation.ts` (grupos `contratos`, `documentos`, `cadastros`, `administracao`); a lista de contratos já calcula "hoje" como `Date.UTC(ano, mês, dia)` do servidor (`src/lib/entities/contratos.server.ts:238`).
- Nenhuma regra `RK-…` do legado está associada aos relatórios em docs/legado/rk-conferencia.md; os requisitos citam o arquivo de evidência.

### Relatórios, filtros e colunas

| Relatório | Rota da tela | API | Filtros (query) | Regra (só `parentId = null`) | Colunas, nesta ordem | Saídas |
|---|---|---|---|---|---|---|
| Contratos por gestor | `/relatorios/contratos-por-gestor` | `GET /api/relatorios/contratos-por-gestor` | `gestor` (CPF), `departamentoId` | agrupa por gestor (`pessoaFisicaId`), tipo e unidade gestora: quantidade e soma de `valorTotal` | Qtde, Tipo, Valor acumulado, Gestor, UN Gestora | tela, PDF "Contratos acumulados pelo gestor", CSV |
| Contratos vencendo | `/relatorios/contratos-vencendo` | `GET /api/relatorios/contratos-vencendo` | `dias` (obrigatório), `inicio`, `fim` (dd/MM/yyyy, opcionais, juntos), `sort`, `dir` | `0 < dataTermino − hoje < dias` (em dias); com período, também `inicio ≤ dataTermino ≤ fim` | Contratada, Gestor, UN Gestora, Tipo, Contrato, Processo, Objeto, Valor total, Vencimento | tela, PDF paisagem "Contratos vencendo em N dias", CSV |
| Contratos vencidos | `/relatorios/contratos-vencidos` | `GET /api/relatorios/contratos-vencidos` | `inicio`, `fim` (obrigatórios) | `inicio ≤ dataTermino ≤ fim` | as do vencendo | tela, PDF paisagem "Contratos vencidos - Período de: dd/MM/yyyy até dd/MM/yyyy", CSV |
| Cadastro incompleto | `/relatorios/cadastro-incompleto` | `GET /api/relatorios/cadastro-incompleto` | — | tipo com `contratoPrincipal = 'S'`, `dataTermino > hoje`, e (`anexo` vazio OU `projetoBasico` vazio) | Nº processo, Nº contrato, Contratada, Objeto, Tem contrato, Tem projeto básico | tela |
| Acompanhamento de meta | `/relatorios/acompanhamento-meta` | `GET /api/relatorios/acompanhamento-meta` | — | três listas (abaixo) | resumo: Lista, Valor total, Nº de termos; detalhe por lista (abaixo) | tela, impressão |
| Acerto de valor | `/relatorios/acerto-valor` | `GET /api/relatorios/acerto-valor`, `PUT /api/relatorios/acerto-valor/:id` | `q` (objeto contém), `page` | `valorInicial` nulo; 20 por página; ordem `numeroContrato` asc | Nº processo, Nº contrato, Objeto, UN Gestora, Contratada, Valor inicial (editável) | tela com gravação |

Origem de cada coluna: Contratada = `prestadorServico.deRazaoSocial`; Gestor = `deNome` da pessoa de
`pessoasPorCpf([Contrato.pessoaFisicaId])` (CPF sem pessoa: o CPF formatado com "(não encontrado)"); UN Gestora = `Departamento.deDepartamento`; Tipo =
`TipoContrato.nome`; Contrato = `numeroContrato`; Processo = `numeroProcesso`; Valor total =
`valorTotal` (`R$`); Vencimento = `dataTermino` (`dd/MM/yyyy`). Valor ausente aparece como "—".

**Acompanhamento de meta** (docs/legado/relatorios.md, "igual ao legado" por decisão do autor):

| Lista | Regra |
|---|---|
| Total | tipo com `contratoPrincipal = 'S'` e `dataTermino > hoje` |
| Vencidos | tipo com `contratoPrincipal = 'S'` e `dataTermino < hoje`, ordem por contratada |
| Em prorrogação/risco | tipo com `indicativoMetaRisco = 'S'` e `0 < dataTermino − hoje ≤ 180` dias |

Resumo: uma linha por lista com Valor total (soma de `valorTotal`) e Nº de termos (quantidade).
Detalhe de cada lista: Processo, Contrato, Objeto, Contratada, Gestor, UN Gestora, Vencimento, Dias
para vencer, Na Presidência (`naPresidencia = 1` → Sim, senão Não), Valor total — os campos que a consulta do legado traz.

## Goals / Non-Goals

**Goals:**
- Os seis relatórios do legado com os mesmos filtros, regras e colunas.
- Nenhum id fixo de tipo de contrato no código.
- PDF e CSV sem dependência nova e sem tirar dado do servidor fora de uma sessão válida.

**Non-Goals:**
- Novos relatórios, gráficos ou painéis.
- Somar aditivos ou usar o vencimento de aditivos (diretiva do autor).
- Controle por perfil (023).

## Decisions

- **Tipo "Contrato" e tipos de prestação como marcações em `tipo_contrato`** — coluna nova `contratoPrincipal TEXT NOT NULL DEFAULT 'N'` (`S`/`N`), no mesmo padrão de `gerenciamento`, `indicativoMetaRisco` e de `prestacaoContas` (esta criada pela 021 para a lista de tipos de prestação; não é duplicada aqui). Toggle do kit com `toggleValues: ["S","N"]`. Alternativa descartada: variável de ambiente com id — repete o defeito do legado (id diferente em desenvolvimento e produção) e não aparece na tela. Mais de um tipo pode ser marcado como `contratoPrincipal`; os relatórios usam `tipoContrato: { contratoPrincipal: 'S' }` (equivale ao legado quando só um está marcado). Nenhum tipo marcado → Cadastro incompleto e Meta mostram o aviso "Nenhum tipo de contrato está marcado como Contrato." com link para `/tipo_contratos`, e a API devolve listas vazias com `avisos: ["SEM_TIPO_CONTRATO"]`.
- **Formulário de tipos** — campos, nesta ordem: `nome`, `gerenciamento`, `contratoPrincipal` ("É o tipo Contrato (relatórios)"), `indicativoMetaRisco` ("Entra no risco da meta") e, por último, `prestacaoContas` ("Sujeito à prestação de contas", da 021). Os dois toggles desta change são opcionais no schema (`z.enum(["S","N"]).optional()`); ausentes, valem o default `N` do banco. Lista ganha as colunas "Contrato" e "Risco da meta" (`format: "boolean"`).
- **Módulo de consultas** — `src/lib/relatorios/`:
  - `comum.ts`: `hojeUtc()` (meia-noite UTC do dia do servidor, igual à lista de contratos), `diasAte(data, hoje)`, `ORIGINAIS = { parentId: null }`, `TIPO_CONTRATO = { tipoContrato: { contratoPrincipal: "S" } }`, `TIPO_RISCO = { tipoContrato: { indicativoMetaRisco: "S" } }`.
  - `chaves.ts`: único ponto que conhece as chaves de 022 — `nomesDosGestores(cpfs)` (embrulha `pessoasPorCpf` de `src/lib/reference/pessoas.ts` e devolve `Map<cpf, deNome>`) e `SELECT_CONTRATADA = { prestadorServico: { select: { deRazaoSocial: true, cnpj: true } } }`. Se 022 mudar algo, só este arquivo muda.
  - Um arquivo por relatório (`contratos-por-gestor.ts`, `contratos-vencendo.ts`, `contratos-vencidos.ts`, `cadastro-incompleto.ts`, `acompanhamento-meta.ts`, `acerto-valor.ts`), cada um exportando `params` (schema zod estrito dos parâmetros) e `consultar(params)`, que devolve `{ titulo, linhas, avisos? }` já com os valores crus (Date, Decimal).
  - `csv.ts`: `toCsv(colunas, linhas)`.
  - As páginas (server components) chamam `consultar` direto; as rotas `/api/relatorios/*` chamam a mesma função. Uma regra, um lugar.
- **Parâmetros** — lidos de `searchParams` e validados por schema zod `.strict()` (parâmetro desconhecido → 400, diretiva de schema estrito; `formato` é o único extra aceito por todos). Datas em `dd/MM/yyyy` (`parseDate`), `dias` inteiro de 1 a 3650, `departamentoId` inteiro, `gestor` 11 dígitos. Mensagens: "Informe o número de dias", "Informe a data inicial", "Informe a data final", "Data inicial posterior à data final", "Informe as duas datas do período". Na tela, o erro aparece inline no filtro e a tabela não é exibida.
- **Datas e dias** — `hoje = hojeUtc()`; `dias = (dataTermino − hoje) / 86 400 000`. "Vencendo" usa `0 < dias < N` (estrito, como `data_termino - hoje > 0 AND < Dias` do legado); "vigente" é `dataTermino > hoje`; "vencido" é `dataTermino < hoje`. Um contrato que vence hoje não é vigente nem vencido (leitura literal do legado; ver Open Questions). Período: `gte inicio` e `lte fim`, inclusive.
- **Ordenação do vencendo** — `sort` ∈ `vencimento` (padrão), `contratada`, `gestor`, `unidade`, `valor`; `dir` ∈ `asc` (padrão), `desc`. Contratada, unidade, vencimento e valor ordenam no banco (`orderBy` por relação, possível porque o fornecedor é FK por `id` — 022 D3); gestor ordena em memória com `localeCompare("pt-BR")` depois de `pessoasPorCpf` (CPF sem FK). Vencidos ordena por vencimento asc; por gestor ordena por gestor, tipo, unidade.
- **Somas em Decimal** — "Valor acumulado" e os totais da Meta somam `Prisma.Decimal` em memória (`.plus`), nunca `_sum` do SQLite (que soma em ponto flutuante) nem `Number`. Contrato com `valorTotal` nulo conta na quantidade e soma zero.
- **Contratos por gestor** — `findMany` dos originais com o filtro, agrupados em memória pela chave `(pessoaFisicaId ?? "", tipoContratoId, departamentoId)`; contratos sem gestor formam o grupo "Sem gestor" (o belongsTo do CakePHP é LEFT JOIN). Ordem: gestor, tipo, unidade (alfabética). Lista do filtro Gestor: `GET /api/relatorios/contratos-por-gestor/gestores` — CPFs distintos de `pessoaFisicaId` dos originais, com o nome (`{ value: cpf, label: deNome }`), ordenados por nome.
- **Cadastro incompleto** — "vazio" é `null` ou `""` (depois da 020 `projetoBasico` guarda o nome do PDF gravado por `savePdf`, e textos antigos já foram zerados pela migração dela). Colunas "Tem contrato" e "Tem projeto básico" mostram Sim/Não.
- **Acerto de valor — gravação** — `PUT /api/relatorios/acerto-valor/:id` com corpo `{ valorInicial: "1.234,56" }` (schema `.strict()`). O servidor converte com `parseCurrency` + `toDecimal` (`src/lib/format.ts`, `src/lib/money.ts`; valor só com milhar `1.234` vira `1.234,00`, como em `contratos.server.ts`). Grava só `valorInicial` com `updateMany({ where: { id, parentId: null, valorInicial: null } })`: contagem 0 → `404` se o id não existe ou é aditivo, `409 "Valor inicial já informado"` se já tem valor. Valor inválido → `400 { errors: { valorInicial: "Informe o valor no formato 1.234,56" } }`. A tela tem, por linha, input moeda (máscara `R$` da fundação) e botão *Gravar*; sucesso → toast (sonner) e a linha sai da lista. Os nulos vêm da carga do legado (025): contratos novos já recebem `valorInicial` por `RK-c3fbde6dbf4a`.
- **CSV (Excel)** — `GET /api/relatorios/<relatorio>?…&formato=csv` (contratos-por-gestor, contratos-vencendo, contratos-vencidos). `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="<relatorio>-AAAA-MM-DD.csv"`, BOM UTF-8, separador `;`, fim de linha CRLF, cabeçalho com os rótulos das colunas. Datas `dd/MM/yyyy`; valores sem `R$` e sem milhar, com vírgula decimal (`1234,56`), para o Excel pt-BR ler como número. Campo com `;`, `"` ou quebra de linha vai entre aspas (aspas duplicadas). Célula que começa com `=`, `+`, `-`, `@`, tab ou CR recebe `'` na frente (injeção de fórmula). Escolha de CSV em vez de `.xlsx`: o Excel abre direto, não exige dependência nova e cobre o `criaExcel` do legado, que exportava uma tabela simples.
- **PDF pela impressão do navegador** — botão *Imprimir / PDF* (`window.print()`) nos relatórios que tinham PDF ou impressão (por gestor, vencendo, vencidos, meta). Justificativa: o PDF do legado é a mesma tabela da tela com um título; "Salvar como PDF" do navegador produz isso sem um motor de PDF no servidor (Chromium headless ou biblioteca de layout) — que aumentaria a imagem Docker e a superfície de ataque num servidor único com SQLite — e sem duplicar o layout. Folha de impressão em `src/app/globals.css` (`@media print`): esconde menu lateral, cabeçalho, filtros e botões (`print:hidden` do Tailwind nos componentes; `[data-slot="sidebar"]` no CSS), remove sombras e cores de fundo, `thead { display: table-header-group }` para repetir o cabeçalho, `tr { break-inside: avoid }`, fonte 9pt. O bloco de título de impressão (`<ReportHeader>`, visível só em `print:block`) mostra o título do legado, os filtros aplicados e "Emitido em dd/MM/yyyy". Vencendo e vencidos renderizam `<style>@page { size: A4 landscape; margin: 10mm }</style>` na própria página; os demais usam A4 retrato. A tela não pagina esses relatórios (o impresso precisa de todas as linhas).
- **Telas (shadcn/ui)** — `/relatorios`: grade de `Card` com título, descrição de uma linha e link para cada relatório. Cada relatório: título (`h1`), formulário de filtros `method="get"` (`Input`, `MaskedInput` de data `dd/MM/yyyy`, `Select` para unidade gestora via `/api/departamentos` e gestor via a rota de gestores, `Button` *Gerar*), barra de ações (*Imprimir / PDF*, *Exportar CSV* como link para a API com os mesmos parâmetros), `Table` com rodapé de totais quando houver (quantidade de contratos; por gestor, também total de Qtde e Valor acumulado). Componentes novos em `src/components/relatorios/`: `report-header.tsx`, `report-actions.tsx` (client), `report-table.tsx`, `acerto-valor-linha.tsx` (client). Sem resultado: "Nenhum contrato encontrado.". Relatórios com filtros obrigatórios (vencidos) abrem sem consulta até o operador gerar.
- **Menu** — item "Relatórios" (`name: "Relatorios"`, `href: "/relatorios"`, `change: "019-relatorios"`) dentro do grupo "Gestão de contratos", depois de "Contratos" em `NAV_ORDER`, ícone `FileChartColumn` do lucide. Um item só, que abre o índice: o grupo "Gestão de contratos" é onde o usuário do legado procura vencimentos, e seis itens a mais no menu lateral pesariam mais que um clique no índice. Breadcrumb: rótulos fixos para os seis slugs (ex.: `contratos-vencendo` → "Contratos vencendo").
- **Acesso** — páginas e APIs exigem sessão (middleware e `requireUser()` como as demais rotas). A gravação do acerto usa `requireUser()`; restrição por perfil fica para 023.

## Risks / Trade-offs

- [Aparência do PDF depende do navegador (margens, cabeçalho/rodapé do navegador)] → `@page` com margens fixas e instrução no índice de desmarcar "Cabeçalhos e rodapés"; teste manual em Chrome e Firefox.
- [Relatórios sem paginação com milhares de linhas] → as consultas fazem `select` só das colunas usadas; o volume do DETRAN-RJ é de centenas a poucos milhares de contratos originais. Se passar de 5 000 linhas, a tela mostra aviso sugerindo restringir o filtro (não corta o resultado).
- [Fuso do servidor define "hoje"] → mesma convenção da lista de contratos; o container deve rodar com `TZ=America/Sao_Paulo` (026-producao).
- [020, 021 ou 022 mudarem nomes de colunas antes do apply] → acesso às chaves isolado em `src/lib/relatorios/chaves.ts`; `projetoBasico` e `naPresidencia` lidos só em `cadastro-incompleto.ts` e `acompanhamento-meta.ts`.
- [Operador desmarca o tipo Contrato por engano] → os relatórios dependentes avisam em vez de mostrar lista vazia sem explicação.

## Open Questions

- **Ordem de aplicação** — 019 depende de 020, 021 e 022, que vêm depois na numeração; o loop do AGENTS.md aplica em ordem numérica (a 022 já registra que 019 vem depois dela). Confirmar com o autor: aplicar 019 depois de 022 (recomendado) ou renumerar.
- **Fornecedor por FK `id`, não por CNPJ** — esta change segue a decisão D3 da 022 (`cnpj` único no fornecedor). Se o autor preferir chave por CNPJ, `chaves.ts` e as ordenações por contratada mudam.
- **Layout exato de `meta.ctp`** — docs/legado/relatorios.md registra "tipo, valor total, nº de termos" na tela e os campos da consulta; a disposição (resumo + detalhe por lista) é a leitura mais provável. Conferir com `getSourceFile("legado/app/views/relatorios/meta.ctp")` antes do apply.
- **Limites de dia** — risco da meta: "até 180 dias" lido como `≤ 180`; vencendo usa `< dias` (literal). Contrato que vence hoje: o legado compara `DATE` com `NOW()` (MySQL)? Se sim, ele já é "vencido" hoje. Confirmar no fonte.
- **Ordenações oferecidas no vencendo** — o legado tem "ordenação escolhida", sem a lista de opções em docs/legado; adotadas as cinco da prestação de contas (contratada, vencimento, valor, unidade, gestor). Confirmar.
- **`dias` obrigatório e sem padrão** — o legado não documenta valor padrão para "Dias". Confirmar se havia (ex.: 30, 60, 90).
- **Grupo "Sem gestor"** — confirmar se o legado mostrava contratos sem gestor no relatório por gestor (LEFT JOIN) ou os omitia.
- **Marcação `prestacaoContas`** — é da 021; se a 021 for descartada ou adiada, a coluna e o toggle precisam voltar para esta change.
- **Regras RK** — docs/legado não associa nenhuma `RK-…` aos relatórios; conferir com `findRules` (módulo `relatorios`) no MCP da RNC e citar as que existirem.
- **Perfil que grava o acerto de valor** — hoje qualquer sessão; no legado, a ação `acertoValor` estava liberada aos quatro grupos (docs/legado/perfis-acesso.md). Definir em 023.
