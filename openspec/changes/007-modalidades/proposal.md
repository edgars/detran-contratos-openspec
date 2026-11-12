# Gestão de Modalidades

## Why

O sistema legado mantém Modalidades na tela "Modalidades" sobre a tabela `modalidades` (1 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/modalidades`, `/modalidades/new`, `/modalidades/[id]/edit` e API `/api/modalidades`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `modalidades`: cadastro de Modalidades: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `modalidades` (migração própria).
- API `/api/modalidades` e páginas de lista/formulário.
- Depende da change de fundação.
