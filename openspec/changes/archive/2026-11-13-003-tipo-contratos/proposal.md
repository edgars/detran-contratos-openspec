# Gestão de TipoContratos

## Why

O sistema legado mantém TipoContratos na tela "Tipo Contratos" sobre a tabela `tipo_contrato` (2 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/tipo_contratos`, `/tipo_contratos/new`, `/tipo_contratos/[id]/edit` e API `/api/tipo_contratos`.
- 0 requirement(s) de negócio do legado (`RK-79134600b4be`, "Informe o tipo de contrato", vale no cadastro de contratos e foi movida para `017-contratos`).
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `tipo-contratos`: cadastro de TipoContratos: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `tipo_contrato` (migração própria).
- API `/api/tipo_contratos` e páginas de lista/formulário.
- Depende da change de fundação.
