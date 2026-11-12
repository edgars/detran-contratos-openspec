# Gestão de Fiscais

## Why

O sistema legado mantém Fiscais na tela "Fiscais" sobre a tabela `fiscais` (4 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/fiscais`, `/fiscais/new`, `/fiscais/[id]/edit` e API `/api/fiscais`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `fiscais`: cadastro de Fiscais: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `fiscais` (migração própria).
- API `/api/fiscais` e páginas de lista/formulário.
- Depende da change de fundação.
