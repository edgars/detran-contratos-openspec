# Gestão de Departamentos

## Why

O sistema legado mantém Departamentos na tela "Departamentos" sobre a tabela `departamentos` (10 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/departamentos`, `/departamentos/new`, `/departamentos/[id]/edit` e API `/api/departamentos`.
- 0 requirement(s) de negócio do legado.
- 1 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `departamentos`: cadastro de Departamentos: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `departamentos` (migração própria).
- API `/api/departamentos` e páginas de lista/formulário.
- Depende da change de fundação.
