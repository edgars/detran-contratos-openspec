# Gestão de Status

## Why

O sistema legado mantém Status na tela "Status" sobre a tabela `status` (3 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/status`, `/status/new`, `/status/[id]/edit` e API `/api/status`.
- 2 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `status`: cadastro de Status: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `status` (migração própria).
- API `/api/status` e páginas de lista/formulário.
- Depende da change de fundação.
