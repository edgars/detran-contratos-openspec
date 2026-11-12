# Spec Delta

## Purpose

Cadastro de Historicos: a aplicação SHALL manter os registros de `historicos` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## ADDED Requirements

### Requirement: Listar Historicos
O sistema SHALL exibir em `/historicos` uma lista paginada de Historicos com busca e as colunas: `contratoId`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/historicos`
- **THEN** vê a tabela com as colunas `contratoId`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Historicos
O sistema SHALL permitir criar um registro de Historicos em `/historicos/new` com os campos, nesta ordem: `descricao`, `contratoId`, `id`, `dataInclusao`, `usuarioId`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `historicos` e a lista o exibe

### Requirement: Editar Historicos
O sistema SHALL permitir editar um registro existente de Historicos em `/historicos/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Historicos
O sistema SHALL permitir excluir um registro de Historicos após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `historicos` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de Historicos
O sistema SHALL rejeitar a gravação de Historicos sem os campos obrigatórios: `contratoId`, `id`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `contratoId` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

### Requirement: `contratoId` referencia Contratos
O campo `contratoId` de Historicos SHALL ser escolhido entre os registros de Contratos (lista de `/api/contratos`) e gravar o id do registro escolhido.

#### Scenario: Escolher um registro relacionado
- **WHEN** o operador abre o campo `contratoId`
- **THEN** vê os registros de Contratos e, ao escolher um, o id é gravado em `contratoId`

### Requirement: `usuarioId` referencia Users
O campo `usuarioId` de Historicos SHALL ser escolhido entre os registros de Users (lista de `/api/users`) e gravar o id do registro escolhido.

#### Scenario: Escolher um registro relacionado
- **WHEN** o operador abre o campo `usuarioId`
- **THEN** vê os registros de Users e, ao escolher um, o id é gravado em `usuarioId`

