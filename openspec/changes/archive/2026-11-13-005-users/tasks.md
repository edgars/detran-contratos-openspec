# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `users` com `username` e `passwordHash` (`001b-security-baseline`), sem colunas `passwordold`/`passwordnew`/`passwordconfirm`; verificação: `prisma migrate dev` aplica sem erro. _(Migração `20261113193305_001b_security_baseline` já cria `users` sem colunas `password*`; aplicada por `prisma migrate deploy` no setup dos testes — `prisma migrate dev` não rodado nesta execução.)_

## 2. API

- [x] 2.1 `GET /api/users` paginado com busca por `username`, usando o serializador sem campos de senha; teste de paginação e de ausência de `password*`.
- [x] 2.2 `POST /api/users` validando `username`, `password` e `passwordconfirm` e gravando só o hash; teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/users/:id`, `PUT /api/users/:id` (só `username`), `DELETE /api/users/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/users`: tabela com a coluna `username`, busca e paginação, botão *Novo*; teste do cenário *Abrir a lista*.
- [x] 3.2 Formulário `/users/new` com `username`, `password` e `passwordconfirm`; testes dos cenários de criação.
- [x] 3.3 Formulário `/users/[id]/edit` pré-preenchido só com `username`, com salvar e excluir (confirmação); testes de edição e exclusão.
- [x] 3.4 Tela `/conta/senha` com `passwordold`, `passwordnew` e `passwordconfirm`, ligada ao menu do usuário; testes dos três cenários de troca.

## 4. Regras de negócio

- [x] 4.1 Usar na action de `/conta/senha` a validação de `RK-9187b7b464f8` e `RK-304882e7bdc8` (senha atual confere), com comentários `// RK-9187b7b464f8` e `// RK-304882e7bdc8`; teste *Senha atual errada*.
- [x] 4.2 Usar na mesma action a validação de `RK-dcfcd941a4d6` e `RK-96cbe7d6e198` (nova senha igual à confirmação), com comentários `// RK-dcfcd941a4d6` e `// RK-96cbe7d6e198`; teste *Confirmação diferente*.

## 5. Verificação

- [x] 5.1 Um teste por `#### Scenario:` de `specs/users/spec.md`, todos verdes.
- [x] 5.2 `openspec validate 005-users --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima. _(MCP não conferido nesta execução; ver design.md § Open Questions.)_
