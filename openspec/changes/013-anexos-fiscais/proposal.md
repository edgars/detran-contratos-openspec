# Gestão de AnexosFiscais

## Why

O sistema legado mantém AnexosFiscais na tela "Anexos Fiscais" sobre a tabela `anexos_fiscais` (1 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/anexos_fiscais`, `/anexos_fiscais/new`, `/anexos_fiscais/[id]/edit` e API `/api/anexos_fiscais`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `anexos-fiscais`: cadastro de AnexosFiscais: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `anexos_fiscais` (migração própria).
- API `/api/anexos_fiscais` e páginas de lista/formulário.
- Depende da change de fundação.
