# Gestão de Users

## Why

O sistema legado mantém usuários na tela "Users" sobre a tabela `users` e oferece a troca de
senha (Login e Alterar Senha). O pacote gerado tratava `passwordold`, `passwordnew` e
`passwordconfirm` como colunas da lista, o que exporia senhas. Esta versão separa o cadastro de
usuários da troca da própria senha e segue `001b-security-baseline`.

## What Changes

- Rotas `/users`, `/users/new`, `/users/[id]/edit`, `/conta/senha` e API `/api/users`.
- Senha só na criação e na troca de senha; nunca listada nem devolvida pela API.
- 4 regras de negócio do legado no fluxo de troca de senha, citadas por `RK-…` (validação compartilhada criada em `001-project-foundation`).

## Capabilities

### New Capabilities

- `users`: cadastro de usuários e troca da própria senha

### Modified Capabilities

_none_

## Impact

- Tabela `users` (migração própria), com `passwordHash` de `001b-security-baseline`.
- API `/api/users` e páginas de lista, formulário e troca de senha.
- Depende da fundação e da base de segurança.

## Fora de escopo

- Associação de usuários a grupos (`groups_users`): depende da decisão sobre permissões em `001b-security-baseline/design.md` § Open Questions.
