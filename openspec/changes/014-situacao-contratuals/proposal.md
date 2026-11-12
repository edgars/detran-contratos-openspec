# Gestão de SituacaoContratuals

## Why

O sistema legado mantém SituacaoContratuals na tela "Situação Contratuals" sobre a tabela `situacao_contratual` (1 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/situacao_contratuals`, `/situacao_contratuals/new`, `/situacao_contratuals/[id]/edit` e API `/api/situacao_contratuals`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `situacao-contratuals`: cadastro de SituacaoContratuals: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `situacao_contratual` (migração própria).
- API `/api/situacao_contratuals` e páginas de lista/formulário.
- Depende da change de fundação.
