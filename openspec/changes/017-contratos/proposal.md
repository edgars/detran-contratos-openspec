# Gestão de Contratos

## Why

O sistema legado mantém Contratos na tela "Contratos" sobre a tabela `contratos` (5 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/contratos`, `/contratos/new`, `/contratos/[id]/edit` e API `/api/contratos`.
- 0 requirement(s) de negócio do legado.
- 5 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `contratos`: cadastro de Contratos: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `contratos` (migração própria).
- API `/api/contratos` e páginas de lista/formulário.
- Depende da change de fundação.
