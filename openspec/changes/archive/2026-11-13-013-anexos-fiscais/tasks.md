# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `anexos_fiscais` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [x] 2.1 `GET /api/anexos_fiscais` paginado com buscapor `anexo`; teste de paginação.
- [x] 2.2 `POST /api/anexos_fiscais` validando o corpo (obrigatórios: `anexo`); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/anexos_fiscais/:id`, `PUT /api/anexos_fiscais/:id`, `DELETE /api/anexos_fiscais/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/anexos_fiscais`: tabela com as colunas de lista (`anexo`), busca e paginação, botão *Novo*.
- [x] 3.2 Formulário `/anexos_fiscais/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [x] 3.3 Formulário `/anexos_fiscais/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [x] 4.1 Um teste por `#### Scenario:` de `specs/anexos-fiscais/spec.md`, todos verdes.
- [x] 4.2 `openspec validate 013-anexos-fiscais --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
