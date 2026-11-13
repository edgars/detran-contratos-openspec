# Spec Delta

## Purpose

Cadastro de usuários: a aplicação SHALL manter os registros de `users` como o sistema legado mantinha — listar, criar, editar, excluir e trocar a própria senha — sem nunca expor senhas.

## ADDED Requirements

### Requirement: Listar Users
O sistema SHALL exibir em `/users` uma lista paginada de usuários com busca e a coluna `username`; nenhum campo de senha SHALL aparecer na lista.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/users`
- **THEN** vê a tabela com a coluna `username`, paginada, sem colunas de senha
- **AND** pode filtrar pela busca

### Requirement: Criar Users
O sistema SHALL permitir criar um usuário em `/users/new` com os campos `username`, `password` e `passwordconfirm`, gravando só o hash da senha.

#### Scenario: Salvar um usuário válido
- **WHEN** o operador preenche usuário, senha e confirmação iguais e salva
- **THEN** o usuário é gravado em `users` com `passwordHash` e a lista o exibe

#### Scenario: Confirmação diferente
- **WHEN** o operador salva com `password` diferente de `passwordconfirm`
- **THEN** o formulário mostra erro no campo de confirmação e nada é gravado

### Requirement: Editar Users
O sistema SHALL permitir editar o `username` de um usuário existente em `/users/[id]/edit`, com o formulário pré-preenchido e sem campos de senha.

#### Scenario: Alterar um usuário
- **WHEN** o operador abre um usuário da lista, altera `username` e salva
- **THEN** o usuário é atualizado e a lista reflete a alteração

### Requirement: Excluir Users
O sistema SHALL permitir excluir um usuário após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um usuário aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o usuário é removido de `users` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de Users
O sistema SHALL rejeitar a gravação de um usuário sem `username`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `username` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

### Requirement: Trocar a própria senha
O sistema SHALL permitir que o usuário logado troque a própria senha em `/conta/senha`, aplicando as regras `RK-9187b7b464f8` e `RK-304882e7bdc8` (senha atual confere) e `RK-dcfcd941a4d6` e `RK-96cbe7d6e198` (nova senha igual à confirmação).

#### Scenario: Senha atual errada
- **WHEN** o usuário informa uma senha atual que não confere
- **THEN** vê "Senha atual não confere!" e a senha não muda

#### Scenario: Confirmação diferente
- **WHEN** o usuário informa nova senha e confirmação diferentes
- **THEN** vê "A nova senha não confere!" e a senha não muda

#### Scenario: Troca válida
- **WHEN** o usuário informa a senha atual correta e nova senha igual à confirmação
- **THEN** o novo hash é gravado e o próximo login aceita só a nova senha
