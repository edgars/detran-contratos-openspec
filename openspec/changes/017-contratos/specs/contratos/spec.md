# Spec Delta

## Purpose

Cadastro de Contratos: a aplicação SHALL manter os registros de `contratos` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## ADDED Requirements

### Requirement: Listar Contratos
O sistema SHALL exibir em `/contratos` uma lista paginada de Contratos com busca e as colunas: `busca`, `tipoContratoId`, `modalidadeId`, `campo`, `ordenar`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/contratos`
- **THEN** vê a tabela com as colunas `busca`, `tipoContratoId`, `modalidadeId`, `campo`, `ordenar`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Contratos
O sistema SHALL permitir criar um registro de Contratos em `/contratos/new` com os campos, nesta ordem: `busca`, `tipoContratoId`, `modalidadeId`, `campo`, `ordenar`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `contratos` e a lista o exibe

### Requirement: Editar Contratos
O sistema SHALL permitir editar um registro existente de Contratos em `/contratos/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Contratos
O sistema SHALL permitir excluir um registro de Contratos após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `contratos` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de Contratos
O sistema SHALL rejeitar a gravação de Contratos sem os campos obrigatórios: `tipoContratoId`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `tipoContratoId` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

### Requirement: `tipoContratoId` referencia TipoContrato
O campo `tipoContratoId` de Contratos SHALL ser escolhido entre os registros de TipoContrato (lista de `/api/tipo_contratos`) e gravar o id do registro escolhido.

#### Scenario: Escolher um registro relacionado
- **WHEN** o operador abre o campo `tipoContratoId`
- **THEN** vê os registros de TipoContrato e, ao escolher um, o id é gravado em `tipoContratoId`

### Requirement: `modalidadeId` referencia Modalidades
O campo `modalidadeId` de Contratos SHALL ser escolhido entre os registros de Modalidades (lista de `/api/modalidades`) e gravar o id do registro escolhido.

#### Scenario: Escolher um registro relacionado
- **WHEN** o operador abre o campo `modalidadeId`
- **THEN** vê os registros de Modalidades e, ao escolher um, o id é gravado em `modalidadeId`

### Requirement: `situacaoContratualId` referencia SituacaoContratual
O campo `situacaoContratualId` de Contratos SHALL ser escolhido entre os registros de SituacaoContratual (lista de `/api/situacao_contratual`) e gravar o id do registro escolhido.

#### Scenario: Escolher um registro relacionado
- **WHEN** o operador abre o campo `situacaoContratualId`
- **THEN** vê os registros de SituacaoContratual e, ao escolher um, o id é gravado em `situacaoContratualId`

### Requirement: `prestadorServicoId` referencia PrestadoresServicos
O campo `prestadorServicoId` de Contratos SHALL ser escolhido entre os registros de PrestadoresServicos (lista de `/api/prestadores_servicos`) e gravar o id do registro escolhido.

#### Scenario: Escolher um registro relacionado
- **WHEN** o operador abre o campo `prestadorServicoId`
- **THEN** vê os registros de PrestadoresServicos e, ao escolher um, o id é gravado em `prestadorServicoId`

### Requirement: `situacaoContratual` referencia SituacaoContratual
O campo `situacaoContratual` de Contratos SHALL ser escolhido entre os registros de SituacaoContratual (lista de `/api/situacao_contratual`) e gravar o id do registro escolhido.

#### Scenario: Escolher um registro relacionado
- **WHEN** o operador abre o campo `situacaoContratual`
- **THEN** vê os registros de SituacaoContratual e, ao escolher um, o id é gravado em `situacaoContratual`

