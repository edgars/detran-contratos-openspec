# Gestão de Penalidades

## Why

O sistema legado mantém Penalidades na tela "Penalidades" sobre a tabela `penalidades` (1 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/penalidades`, `/penalidades/new`, `/penalidades/[id]/edit` e API `/api/penalidades`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `penalidades`: cadastro de Penalidades: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `penalidades` (migração própria).
- API `/api/penalidades` e páginas de lista/formulário.
- Depende da change de fundação.
