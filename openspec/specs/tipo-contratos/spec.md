# tipo-contratos Specification

## Purpose
Cadastro de TipoContratos: a aplicação SHALL manter os registros de `tipo_contrato` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Listar TipoContratos
O sistema SHALL exibir em `/tipo_contratos` uma lista paginada de TipoContratos com busca e as colunas: `nome`, `gerenciamento`, `contratoPrincipal` ("Contrato") e `indicativoMetaRisco` ("Risco da meta"), as duas últimas como Sim/Não.

Alteração (019-relatorios): a lista ganha as colunas das duas marcações usadas pelos relatórios.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/tipo_contratos`
- **THEN** vê a tabela com as colunas `nome`, `gerenciamento`, Contrato e Risco da meta, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar TipoContratos
O sistema SHALL permitir criar um registro de TipoContratos em `/tipo_contratos/new` com os campos, nesta ordem: `nome`, `gerenciamento`, `contratoPrincipal`, `indicativoMetaRisco` e, por último, `prestacaoContas` (toggle da 021-prestacao-contas-fluxo).

Alteração (019-relatorios): acrescentados os toggles `contratoPrincipal` e `indicativoMetaRisco`, depois de `gerenciamento`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `tipo_contrato` e a lista o exibe

### Requirement: Editar TipoContratos
O sistema SHALL permitir editar um registro existente de TipoContratos em `/tipo_contratos/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir TipoContratos
O sistema SHALL permitir excluir um registro de TipoContratos após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `tipo_contrato` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de TipoContratos
O sistema SHALL rejeitar a gravação de TipoContratos sem os campos obrigatórios: `gerenciamento`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `gerenciamento` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

### Requirement: Tipo de contrato sujeito à prestação de contas
O sistema SHALL guardar em `tipo_contrato.prestacaoContas` ("S"/"N", padrão "N") se o tipo entra na prestação de contas, no lugar dos ids fixos do legado (`docs/legado/prestacao-contas.md`). Os formulários de tipo MUST exibir, depois dos demais campos, o toggle opcional "Sujeito à prestação de contas" (schema `zod` estrito); `GET /api/tipo_contratos` MUST aceitar o filtro `prestacaoContas=S|N`.

#### Scenario: Marcar um tipo
- **GIVEN** o tipo "Contrato" com `prestacaoContas = "N"`
- **WHEN** o operador liga "Sujeito à prestação de contas" em `/tipo_contratos/[id]/edit` e salva
- **THEN** o tipo passa a `prestacaoContas = "S"` e seus contratos vencidos acima do limite entram na lista de prestação de contas

#### Scenario: Tipo novo nasce desmarcado
- **WHEN** o operador cria um tipo sem mexer no toggle
- **THEN** o tipo é gravado com `prestacaoContas = "N"`

#### Scenario: Valor inválido
- **WHEN** a API recebe `POST /api/tipo_contratos` com `prestacaoContas = "X"`
- **THEN** responde `400` com erro em `prestacaoContas` e nada é gravado

#### Scenario: Filtrar tipos marcados
- **GIVEN** um tipo com `prestacaoContas = "S"` e outro com "N"
- **WHEN** a API recebe `GET /api/tipo_contratos?prestacaoContas=S`
- **THEN** devolve só o tipo marcado

### Requirement: Marcações do tipo de contrato
O tipo de contrato SHALL guardar as marcações `S`/`N`, com padrão `N`, `contratoPrincipal` (conta como "Contrato" nos relatórios, no lugar do id fixo `Contrato::tipoContratoId` do legado) e `indicativoMetaRisco` (entra na lista "Em prorrogação/risco" da meta, `indicativo_meta_risco` do legado). Mais de um tipo pode ter cada marcação.

#### Scenario: Marcar o tipo Contrato
- **WHEN** o operador liga "É o tipo Contrato (relatórios)" no tipo "Contrato" e salva
- **THEN** o registro é gravado com `contratoPrincipal = 'S'` e a lista mostra "Sim" na coluna Contrato

### Requirement: Validação das marcações
A API de tipos de contrato SHALL aceitar só `S` ou `N` em `contratoPrincipal` e `indicativoMetaRisco` e, quando ausentes na criação, gravar `N`.

#### Scenario: Valor fora de S/N
- **WHEN** chega um `POST /api/tipo_contratos` com `contratoPrincipal: "X"`
- **THEN** a resposta é `400` com a mensagem do campo `contratoPrincipal` e nada é gravado

#### Scenario: Marcações ausentes
- **WHEN** chega um `POST /api/tipo_contratos` só com `nome` e `gerenciamento`
- **THEN** o registro é gravado com `contratoPrincipal` e `indicativoMetaRisco` iguais a `N`
