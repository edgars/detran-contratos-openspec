# Gestão de ContratoStatus

## Why

O sistema legado mantém ContratoStatus na tela "Contrato Status" sobre a tabela `contrato_status` (2 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/contrato_status`, `/contrato_status/new`, `/contrato_status/[id]/edit` e API `/api/contrato_status`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `contrato-status`: cadastro de ContratoStatus: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `contrato_status` (migração própria).
- API `/api/contrato_status` e páginas de lista/formulário.
- Depende da change de fundação.
