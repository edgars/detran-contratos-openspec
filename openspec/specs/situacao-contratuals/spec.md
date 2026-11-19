# situacao-contratuals Specification

## Purpose
Cadastro de SituacaoContratuals: a aplicação SHALL manter os registros de `situacao_contratual` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Listar SituacaoContratuals
O sistema SHALL exibir em `/situacao_contratuals` uma lista paginada de SituacaoContratuals com busca e as colunas: `descricao`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/situacao_contratuals`
- **THEN** vê a tabela com as colunas `descricao`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar SituacaoContratuals
O sistema SHALL permitir criar um registro de SituacaoContratuals em `/situacao_contratuals/new` com os campos, nesta ordem: `descricao`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `situacao_contratual` e a lista o exibe

### Requirement: Editar SituacaoContratuals
O sistema SHALL permitir editar um registro existente de SituacaoContratuals em `/situacao_contratuals/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir SituacaoContratuals
O sistema SHALL permitir excluir um registro de SituacaoContratuals após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `situacao_contratual` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada
