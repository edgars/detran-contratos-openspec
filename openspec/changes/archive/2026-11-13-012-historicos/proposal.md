# Gestão de Historicos

## Why

O sistema legado mantém Historicos na tela "Históricos" sobre a tabela `historicos` (5 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/historicos`, `/historicos/new`, `/historicos/[id]/edit` e API `/api/historicos`.
- 0 requirement(s) de negócio do legado.
- 2 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `historicos`: cadastro de Historicos: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `historicos` (migração própria).
- API `/api/historicos` e páginas de lista/formulário.
- Depende da change de fundação.
