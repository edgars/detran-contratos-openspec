# Design

## Context

Stack decidida no Architecture Canvas da RNC. Modelo de dados completo abaixo; cada change de
entidade repete só a sua tabela.

## Goals / Non-Goals

**Goals:**
- Um esqueleto que roda vazio (`docker compose up --build`) antes da primeira entidade.
- Convenções únicas que as changes de entidade só reutilizam.

**Non-Goals:**
- Nenhuma tela de domínio: elas chegam pelas changes de entidade.
- Nenhuma migração de dados do legado.

## Decisions

- **Stack** — frontend nextjs, backend nextjs + prisma, banco sqlite. Escolhida no canvas da RNC como substituta suportada do legado.
- **Biblioteca de UI — shadcn/ui** (https://ui.shadcn.com). Toda tela usa seus componentes; nunca uma segunda biblioteca. Setup:
  - `npx shadcn@latest init`
  - `npx shadcn@latest add button input textarea select command popover calendar switch table pagination alert-dialog sonner form sidebar breadcrumb dropdown-menu`
  Tema: CSS variables on `:root` and `.dark` (`--background`, `--foreground`, `--primary`, `--destructive`, `--border`, `--ring`…); dark mode toggles the `.dark` class on `<html>`.
- **Locale e formatos** — locale pt-BR, datas `dd/MM/yyyy`, moeda `R$` (Configurações da Aplicação na RNC). Um formatador compartilhado por toda lista e formulário; nunca formatar inline.
- **Um módulo por entidade gerenciada** — rota, API, validação e páginas próprias; espelha a estrutura tela-por-entidade do legado.
- **Tabelas de referência são lookups, não telas** — API read-only; o FK guarda o id do registro relacionado. Reproduz o comportamento do legado sem inventar CRUD.
- **Valores monetários em `Decimal`** — `pagamentos.valor`, `pagamentos.valorGlosa`, `contratos.valorInicial`, `contratos.valorMensal` e `contratos.valorTotal` usam `Decimal` no Prisma, nunca `Float` (o legado usava FLOAT, inadequado para dinheiro).
- **Configuração por ambiente** — tudo em `.env` com `.env.example` versionado; segredos nunca no código.

## Modelo de dados

### Departamentos (`departamentos`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| deDepartamento | String | não |
| codigo | String? | sim |
| deLogradouro | String? | sim |
| deComplemento | String? | sim |
| deBairro | String? | sim |
| deCidade | String? | sim |
| cep | String? | sim |
| diretoriaId | Int | não |
| municipioId | Int? | sim |

**Relações:**
- pertence a `Diretorias` via `diretoriaId`

### TipoContrato (`tipo_contrato`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| nome | String? | sim |
| gerenciamento | String | não |
| indicativoMetaRisco | String | não |

**Relações:**
- tem muitos `Contratos`

### ContratoStatus (`contrato_status`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| contratoId | Int | não |
| statusId | Int | não |
| dataInclusao | DateTime? | sim |
| descricao | String? | sim |
| usuarioId | Int? | sim |
| atendido | Int? | sim |
| aditivoId | Int? | sim |

### Users (`users`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| username | String | não |
| passwordHash | String | não |
| created | DateTime? | sim |
| modified | DateTime? | sim |
| pessoaId | Int | não |
| superuser | Int? | sim |
| inativo | Int? | sim |
| ultimoLogin | DateTime? | sim |

**Relações:**
- tem muitos `Historicos`

### Pagamentos (`pagamentos`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| competencia | DateTime | não |
| numeroProcesso | String | não |
| contratoId | Int | não |
| valor | Decimal? | sim |
| empenho | String? | sim |
| notaFiscal | String? | sim |
| notaLiquidacao | String? | sim |
| ordemBancaria | String? | sim |
| glosa | String? | sim |
| valorGlosa | Decimal? | sim |
| mes | String? | sim |
| ano | String? | sim |

### Modalidades (`modalidades`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| nome | String? | sim |

**Relações:**
- tem muitos `Contratos`

### PrestacaoContas (`prestacao_contas`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| descricao | String? | sim |
| atendido | String? | sim |
| dataInclusao | DateTime? | sim |
| faseId | Int | não |
| userId | Int | não |
| contratoId | Int | não |

### Fases (`fases`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| nome | String | não |
| periodo | String | não |

### Fiscais (`fiscais`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| contratoId | Int | não |
| pessoaFisicaCpf | String | não |
| suplente | String | não |
| dataInclusao | DateTime? | sim |
| presidente | String | não |
| busca | String? | sim |

### Status (`status`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| nome | String? | sim |
| fluxo | String? | sim |
| periodo | Int? | sim |

### Historicos (`historicos`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| contratoId | Int | não |
| dataInclusao | DateTime? | sim |
| descricao | String? | sim |
| usuarioId | Int? | sim |

**Relações:**
- pertence a `Contratos` via `contratoId`
- pertence a `Users` via `usuarioId`

### AnexosFiscais (`anexos_fiscais`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| anexo | String | não |
| dataRegistro | DateTime | não |
| contratoId | Int | não |

### SituacaoContratual (`situacao_contratual`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| descricao | String? | sim |

**Relações:**
- tem muitos `Contratos`
- tem muitos `Contratos`

### AnexosPublicacao (`anexos_publicacao`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| anexo | String? | sim |
| contratoId | Int | não |
| dataPublicacao | DateTime | não |

### Penalidades (`penalidades`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| dataRegistro | DateTime | não |
| arquivo | String? | sim |
| contratoId | Int | não |
| userId | Int | não |

### Contratos (`contratos`)

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| numeroProcesso | String? | sim |
| numeroContrato | String? | sim |
| periodo | String? | sim |
| parentId | Int? | sim |
| dataInclusao | DateTime? | sim |
| dataInicio | DateTime? | sim |
| dataTermino | DateTime? | sim |
| valorInicial | Decimal? | sim |
| valorMensal | Decimal? | sim |
| valorTotal | Decimal? | sim |
| departamentoId | Int? | sim |
| pessoaFisicaId | String? | sim |
| suplenteId | String? | sim |
| prestadorServicoId | Int? | sim |
| tipoContratoId | Int? | sim |
| modalidadeId | Int? | sim |
| situacaoContratualId | Int? | sim |
| objeto | String | não |
| anexoTipo | String? | sim |
| anexo | String? | sim |
| projetoBasico | String? | sim |
| numeroModalidade | String? | sim |
| naPresidencia | Int? | sim |
| prestacaoRealizada | String? | sim |
| numeroFiscais | String? | sim |

**Relações:**
- pertence a `TipoContrato` via `tipoContratoId`
- pertence a `Modalidades` via `modalidadeId`
- pertence a `SituacaoContratual` via `situacaoContratualId`
- pertence a `PrestadoresServicos` via `prestadorServicoId`
- pertence a `Departamentos` via `departamentoId`
- pertence a `Contratos` via `parentId` (aditivo do contrato original)
- tem muitos `Historicos`

_Ajuste:_ `busca`, `campo`, `ordenar`, `buscaDepto`, `buscaGestor`, `buscaGestorSuplente`, `vencendo`, `deRazaoSocial`, `deDepartamento` e `deNome` são filtros da tela de pesquisa do legado, não colunas; `situacaoContratual` duplicava `situacaoContratualId`. Ver `017-contratos/design.md`.

### Diretorias (`diretorias`)  _— tabela de referência_

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| deDiretoria | String | não |
| codigo | String | não |

**Relações:**
- tem muitos `Departamentos`

### PessoasFisicas (`pessoas_fisicas`)  _— tabela de referência_

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| idPessoaFisica | Int | não |
| deNome | String? | sim |
| deEndereco | String? | sim |
| deBairro | String? | sim |
| deTelefone | String? | sim |
| deNomePai | String? | sim |
| deNomeMae | String? | sim |
| deNaturalidade | String? | sim |
| deUrlFoto | String? | sim |
| prestadorServico | String? | sim |
| cep | String? | sim |
| pseudonimo | String? | sim |
| nuExtraQuadro | String? | sim |
| nuRegistro | String? | sim |
| nuMatricula | String? | sim |
| identidadeFuncional | String? | sim |
| vinculo | Int? | sim |
| flTermoImpresso | String? | sim |
| flFuncionarioPublico | String? | sim |
| flConformidadeTermo | String? | sim |
| flEmitirCracha | String? | sim |
| flAprovado | String? | sim |
| flAposentado | Int? | sim |
| dtNascimento | DateTime | não |
| dtInclusaoTermo | DateTime? | sim |
| dtTermoRecebido | DateTime? | sim |
| dtTermoPreAprovado | DateTime? | sim |
| dtCracha | DateTime? | sim |
| dtCorregedoria | DateTime? | sim |
| dtInformatica | DateTime? | sim |
| dtExcluido | DateTime? | sim |
| dtUltimaAlteracaoTermo | DateTime? | sim |
| foto | String? | sim |
| municipioId | Int? | sim |
| cargoId | Int? | sim |
| tipoSanguineoId | Int? | sim |
| departamentoId | Int? | sim |
| lotacaoId | Int? | sim |
| lotacaoOrigemId | Int? | sim |
| ufId | String? | sim |
| orgaoExpedidorId | Int? | sim |
| origemExternaId | Int? | sim |
| nacionalidadeId | Int? | sim |
| guiaRemessaId | Int? | sim |
| guiaRemessaCrachaId | Int? | sim |
| usuarioCorregedoriaId | Int? | sim |
| usuarioDpId | Int? | sim |
| flAlteracao | Int? | sim |
| deObservacao | String? | sim |
| deSimbolo | String? | sim |
| dtPublicDoerj | DateTime? | sim |
| dtValidade | DateTime? | sim |
| dtNomeacao | DateTime? | sim |
| dtPosse | DateTime? | sim |
| dtExercicio | DateTime? | sim |
| flPublicadoDoerj | String? | sim |
| dtPublicDoerjN | DateTime? | sim |
| lotacaoCgpId | Int? | sim |

### Pessoas (`pessoas`)  _— tabela de referência_

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| cpf | String? | sim |
| cnpj | String? | sim |

### PrestadoresServicos (`prestadores_servicos`)  _— tabela de referência_

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| deRazaoSocial | String | não |

**Relações:**
- tem muitos `Contratos`

### GroupsUsers (`groups_users`)  _— tabela de referência_

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| groupId | Int | não |
| userId | Int | não |
| acoId | Int? | sim |

### PagamentoArquivos (`pagamento_arquivos`)  _— tabela de referência_

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| arquivo | String | não |
| pagamentoId | Int | não |

### Groups (`groups`)  _— tabela de referência_

| Coluna | Tipo | Nulo |
|---|---|---|
| id | Int (PK, auto) | não |
| name | String | não |
| created | DateTime? | sim |
| modified | DateTime? | sim |
| acoId | Int? | sim |
| descricao | String? | sim |

## Relações prováveis (derivadas — confirmar antes de impor)

O legado não declara chaves estrangeiras. Estas coincidências de nome sugerem joins; confirme
contra o código legado (ou pelo MCP da RNC) antes de criar constraints. O schema não as inclui.

- **Departamentos** ↔ **Contratos** compartilham `deDepartamento` — provavelmente unidas por isso no legado.
- **Departamentos** ↔ **Diretorias** compartilham `codigo` — provavelmente unidas por isso no legado.
- **Departamentos** ↔ **PessoasFisicas** compartilham `deBairro`, `cep`, `municipioId` — provavelmente unidas por isso no legado.
- **ContratoStatus** ↔ **Pagamentos** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **ContratoStatus** ↔ **PrestacaoContas** compartilham `atendido`, `dataInclusao`, `contratoId` — provavelmente unidas por isso no legado.
- **ContratoStatus** ↔ **Fiscais** compartilham `contratoId`, `dataInclusao` — provavelmente unidas por isso no legado.
- **ContratoStatus** ↔ **Historicos** compartilham `contratoId`, `dataInclusao`, `usuarioId` — provavelmente unidas por isso no legado.
- **ContratoStatus** ↔ **AnexosFiscais** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **ContratoStatus** ↔ **AnexosPublicacao** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **ContratoStatus** ↔ **Penalidades** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **ContratoStatus** ↔ **Contratos** compartilham `dataInclusao` — provavelmente unidas por isso no legado.
- **Users** ↔ **Groups** compartilham `created`, `modified` — provavelmente unidas por isso no legado.
- **Pagamentos** ↔ **PrestacaoContas** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Pagamentos** ↔ **Fiscais** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Pagamentos** ↔ **Historicos** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Pagamentos** ↔ **AnexosFiscais** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Pagamentos** ↔ **AnexosPublicacao** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Pagamentos** ↔ **Penalidades** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Pagamentos** ↔ **Contratos** compartilham `numeroProcesso` — provavelmente unidas por isso no legado.
- **PrestacaoContas** ↔ **Fiscais** compartilham `contratoId`, `dataInclusao` — provavelmente unidas por isso no legado.
- **PrestacaoContas** ↔ **Historicos** compartilham `contratoId`, `dataInclusao` — provavelmente unidas por isso no legado.
- **PrestacaoContas** ↔ **AnexosFiscais** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **PrestacaoContas** ↔ **AnexosPublicacao** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **PrestacaoContas** ↔ **Penalidades** compartilham `contratoId`, `userId` — provavelmente unidas por isso no legado.
- **PrestacaoContas** ↔ **Contratos** compartilham `dataInclusao` — provavelmente unidas por isso no legado.
- **PrestacaoContas** ↔ **GroupsUsers** compartilham `userId` — provavelmente unidas por isso no legado.
- **Fases** ↔ **Status** compartilham `periodo` — provavelmente unidas por isso no legado.
- **Fases** ↔ **Contratos** compartilham `periodo` — provavelmente unidas por isso no legado.
- **Fiscais** ↔ **Historicos** compartilham `contratoId`, `dataInclusao` — provavelmente unidas por isso no legado.
- **Fiscais** ↔ **AnexosFiscais** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Fiscais** ↔ **AnexosPublicacao** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Fiscais** ↔ **Penalidades** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Fiscais** ↔ **Contratos** compartilham `dataInclusao`, `busca` — provavelmente unidas por isso no legado.
- **Status** ↔ **Contratos** compartilham `periodo` — provavelmente unidas por isso no legado.
- **Historicos** ↔ **AnexosFiscais** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Historicos** ↔ **AnexosPublicacao** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Historicos** ↔ **Penalidades** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **Historicos** ↔ **Contratos** compartilham `dataInclusao` — provavelmente unidas por isso no legado.
- **AnexosFiscais** ↔ **AnexosPublicacao** compartilham `anexo`, `contratoId` — provavelmente unidas por isso no legado.
- **AnexosFiscais** ↔ **Penalidades** compartilham `dataRegistro`, `contratoId` — provavelmente unidas por isso no legado.
- **AnexosFiscais** ↔ **Contratos** compartilham `anexo` — provavelmente unidas por isso no legado.
- **AnexosPublicacao** ↔ **Penalidades** compartilham `contratoId` — provavelmente unidas por isso no legado.
- **AnexosPublicacao** ↔ **Contratos** compartilham `anexo` — provavelmente unidas por isso no legado.
- **Penalidades** ↔ **GroupsUsers** compartilham `userId` — provavelmente unidas por isso no legado.
- **Penalidades** ↔ **PagamentoArquivos** compartilham `arquivo` — provavelmente unidas por isso no legado.
- **Contratos** ↔ **PessoasFisicas** compartilham `deNome`, `departamentoId` — provavelmente unidas por isso no legado.
- **Contratos** ↔ **PrestadoresServicos** compartilham `deRazaoSocial` — provavelmente unidas por isso no legado.
- **GroupsUsers** ↔ **Groups** compartilham `acoId` — provavelmente unidas por isso no legado.

## Máscaras de campo e serviços

Do perfil de geração da RNC (locale pt-BR), resolvidas pelo nome do campo. Só os tipos que ocorrem neste build estão listados; cada change de entidade repete os próprios campos nas colunas Máscara e Comportamento. `#` = dígito, `A` = letra.

| Tipo | Máscara |
|---|---|
| CPF | `###.###.###-##` |
| CEP | `#####-###` |


## Risks / Trade-offs

- [Stack diferente da escolhida] → `design.md` e `config.yaml` são a referência; o agente não troca stack.
- [Schema inventado para campo a confirmar] → cada change lista seus campos a confirmar; sem coluna confirmada, sem coluna.

## Open Questions

- **Autenticação** — resolvida: login local com senha em hash, especificado na change `001b-security-baseline` (capability `security`). SSO continua desligado. As regras `RK-9187b7b464f8`, `RK-dcfcd941a4d6`, `RK-304882e7bdc8` e `RK-96cbe7d6e198` valem no fluxo de troca de senha de `005-users`.
