# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `penalidades` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [ ] 2.1 `GET /api/penalidades` paginado com buscapor `arquivo`; teste de paginação.
- [ ] 2.2 `POST /api/penalidades` validando o corpo (obrigatórios: nenhum); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/penalidades/:id`, `PUT /api/penalidades/:id`, `DELETE /api/penalidades/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/penalidades`: tabela com as colunas de lista (`arquivo`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/penalidades/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/penalidades/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/penalidades/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 016-penalidades --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
