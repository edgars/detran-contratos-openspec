# Gestão de Fases

## Why

O sistema legado mantém Fases na tela "Fases" sobre a tabela `fases` (2 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/fases`, `/fases/new`, `/fases/[id]/edit` e API `/api/fases`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `fases`: cadastro de Fases: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `fases` (migração própria).
- API `/api/fases` e páginas de lista/formulário.
- Depende da change de fundação.
