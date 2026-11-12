# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `users` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [ ] 2.1 `GET /api/users` paginado com buscapor `username`, `passwordold`, `passwordnew`, `passwordconfirm`; teste de paginação.
- [ ] 2.2 `POST /api/users` validando o corpo (obrigatórios: `username`); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/users`: tabela com as colunas de lista (`username`, `passwordold`, `passwordnew`, `passwordconfirm`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/users/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/users/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/users/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 005-users --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
