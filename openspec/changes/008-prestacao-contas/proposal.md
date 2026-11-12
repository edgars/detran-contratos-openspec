# Gestão de PrestacaoContas

## Why

O sistema legado mantém PrestacaoContas na tela "Prestação Contas" sobre a tabela `prestacao_contas` (2 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/prestacao_contas`, `/prestacao_contas/new`, `/prestacao_contas/[id]/edit` e API `/api/prestacao_contas`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `prestacao-contas`: cadastro de PrestacaoContas: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `prestacao_contas` (migração própria).
- API `/api/prestacao_contas` e páginas de lista/formulário.
- Depende da change de fundação.
