# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `situacao_contratual` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [x] 2.1 `GET /api/situacao_contratuals` paginado com buscapor `descricao`; teste de paginação.
- [x] 2.2 `POST /api/situacao_contratuals` validando o corpo (obrigatórios: nenhum); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/situacao_contratuals/:id`, `PUT /api/situacao_contratuals/:id`, `DELETE /api/situacao_contratuals/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/situacao_contratuals`: tabela com as colunas de lista (`descricao`), busca e paginação, botão *Novo*.
- [x] 3.2 Formulário `/situacao_contratuals/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [x] 3.3 Formulário `/situacao_contratuals/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [x] 4.1 Um teste por `#### Scenario:` de `specs/situacao-contratuals/spec.md`, todos verdes.
- [x] 4.2 `openspec validate 014-situacao-contratuals --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
