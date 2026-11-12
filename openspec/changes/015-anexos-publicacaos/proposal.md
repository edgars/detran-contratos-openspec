# Gestão de AnexosPublicacaos

## Why

O sistema legado mantém AnexosPublicacaos na tela "Anexos Publicações" sobre a tabela `anexos_publicacao` (1 campo(s)). A aplicação
moderna precisa preservar esse cadastro — listar, criar, editar e excluir — com as regras de
negócio que o legado aplica, citadas pela chave `RK-…`.

## What Changes

- Rotas `/anexos_publicacaos`, `/anexos_publicacaos/new`, `/anexos_publicacaos/[id]/edit` e API `/api/anexos_publicacaos`.
- 0 requirement(s) de negócio do legado.
- 0 lookup(s) para outras entidades.

## Capabilities

### New Capabilities

- `anexos-publicacaos`: cadastro de AnexosPublicacaos: lista, formulários, exclusão e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `anexos_publicacao` (migração própria).
- API `/api/anexos_publicacaos` e páginas de lista/formulário.
- Depende da change de fundação.
