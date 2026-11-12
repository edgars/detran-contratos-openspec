# Gestão de Users

## Why

O sistema legado mantém Users na tela "Users" sobre a tabela `users` (4 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/users`, `/users/new`, `/users/[id]/edit` e API `/api/users`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `users`: cadastro de Users: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `users` (migração própria).
- API `/api/users` e páginas de lista/formulário.
- Depende da change de fundação.
