# Gestão de Pagamentos

## Why

O sistema legado mantém Pagamentos na tela "Pagamentos" sobre a tabela `pagamentos` (10 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/pagamentos`, `/pagamentos/new`, `/pagamentos/[id]/edit` e API `/api/pagamentos`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `pagamentos`: cadastro de Pagamentos: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `pagamentos` (migração própria).
- API `/api/pagamentos` e páginas de lista/formulário.
- Depende da change de fundação.
