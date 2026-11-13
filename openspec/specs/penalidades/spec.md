# penalidades Specification

## Purpose
Cadastro de Penalidades: a aplicação SHALL manter os registros de `penalidades` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Listar Penalidades
O sistema SHALL exibir em `/penalidades` uma lista paginada de Penalidades com busca e as colunas: `arquivo`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/penalidades`
- **THEN** vê a tabela com as colunas `arquivo`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Penalidades
O sistema SHALL permitir criar um registro de Penalidades em `/penalidades/new` com os campos, nesta ordem: `arquivo`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `penalidades` e a lista o exibe

### Requirement: Editar Penalidades
O sistema SHALL permitir editar um registro existente de Penalidades em `/penalidades/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Penalidades
O sistema SHALL permitir excluir um registro de Penalidades após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `penalidades` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada
