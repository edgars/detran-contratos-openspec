# Spec Delta

## Purpose

Cadastro de Modalidades: a aplicação SHALL manter os registros de `modalidades` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## ADDED Requirements

### Requirement: Listar Modalidades
O sistema SHALL exibir em `/modalidades` uma lista paginada de Modalidades com busca e as colunas: `nome`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/modalidades`
- **THEN** vê a tabela com as colunas `nome`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Modalidades
O sistema SHALL permitir criar um registro de Modalidades em `/modalidades/new` com os campos, nesta ordem: `nome`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `modalidades` e a lista o exibe

### Requirement: Editar Modalidades
O sistema SHALL permitir editar um registro existente de Modalidades em `/modalidades/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Modalidades
O sistema SHALL permitir excluir um registro de Modalidades após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `modalidades` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

