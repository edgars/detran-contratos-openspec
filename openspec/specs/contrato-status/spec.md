# contrato-status Specification

## Purpose
Cadastro de ContratoStatus: a aplicação SHALL manter os registros de `contrato_status` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Listar ContratoStatus
O sistema SHALL exibir em `/contrato_status` uma lista paginada de ContratoStatus com busca e as colunas: `descricao`, `atendido`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/contrato_status`
- **THEN** vê a tabela com as colunas `descricao`, `atendido`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar ContratoStatus
O sistema SHALL permitir criar um registro de ContratoStatus em `/contrato_status/new` com os campos, nesta ordem: `descricao`, `atendido`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `contrato_status` e a lista o exibe

### Requirement: Editar ContratoStatus
O sistema SHALL permitir editar um registro existente de ContratoStatus em `/contrato_status/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir ContratoStatus
O sistema SHALL permitir excluir um registro de ContratoStatus após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `contrato_status` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada
