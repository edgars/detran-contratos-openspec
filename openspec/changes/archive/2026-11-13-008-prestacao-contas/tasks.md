# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `prestacao_contas` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM. _(Modelo e migração `20261113193318_008_prestacao_contas` já existentes; aplicada por `prisma migrate deploy` no setup dos testes.)_

## 2. API

- [x] 2.1 `GET /api/prestacao_contas` paginado com buscapor `descricao`, `atendido`; teste de paginação.
- [x] 2.2 `POST /api/prestacao_contas` validando o corpo (obrigatórios: nenhum); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/prestacao_contas/:id`, `PUT /api/prestacao_contas/:id`, `DELETE /api/prestacao_contas/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/prestacao_contas`: tabela com as colunas de lista (`descricao`, `atendido`), busca e paginação, botão *Novo*.
- [x] 3.2 Formulário `/prestacao_contas/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [x] 3.3 Formulário `/prestacao_contas/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [x] 4.1 Um teste por `#### Scenario:` de `specs/prestacao-contas/spec.md`, todos verdes.
- [x] 4.2 `openspec validate 008-prestacao-contas --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima. _(MCP não conferido; a change não cita `RK-…`.)_
