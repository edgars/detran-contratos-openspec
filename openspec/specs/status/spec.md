# status Specification

## Purpose
Cadastro de Status: a aplicação SHALL manter os registros de `status` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Listar Status
O sistema SHALL exibir em `/status` uma lista paginada de Status com busca e as colunas: `nome`, `fluxo`, `periodo`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/status`
- **THEN** vê a tabela com as colunas `nome`, `fluxo`, `periodo`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Status
O sistema SHALL permitir criar um registro de Status em `/status/new` com os campos, nesta ordem: `nome`, `fluxo`, `periodo`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `status` e a lista o exibe

### Requirement: Editar Status
O sistema SHALL permitir editar um registro existente de Status em `/status/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Status
O sistema SHALL permitir excluir um registro de Status após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `status` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: status_id is required
O sistema SHALL aplicar a regra `RK-a7017eb6c42d`: status_id is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `status_id`
- **WHEN** a condição `status_id IS NOT NULL` se verifica
- **THEN** status_id is required

### Requirement: status_id is required (2)
O sistema SHALL aplicar a regra `RK-067d06861847`: status_id is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `status_id`
- **WHEN** a condição `status_id IS NOT NULL` se verifica
- **THEN** status_id is required
