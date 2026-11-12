# Spec Delta

## Purpose

Cadastro de Users: a aplicação SHALL manter os registros de `users` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## ADDED Requirements

### Requirement: Listar Users
O sistema SHALL exibir em `/users` uma lista paginada de Users com busca e as colunas: `username`, `passwordold`, `passwordnew`, `passwordconfirm`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/users`
- **THEN** vê a tabela com as colunas `username`, `passwordold`, `passwordnew`, `passwordconfirm`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Users
O sistema SHALL permitir criar um registro de Users em `/users/new` com os campos, nesta ordem: `username`, `passwordold`, `passwordnew`, `passwordconfirm`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `users` e a lista o exibe

### Requirement: Editar Users
O sistema SHALL permitir editar um registro existente de Users em `/users/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Users
O sistema SHALL permitir excluir um registro de Users após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `users` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de Users
O sistema SHALL rejeitar a gravação de Users sem os campos obrigatórios: `username`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `username` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

