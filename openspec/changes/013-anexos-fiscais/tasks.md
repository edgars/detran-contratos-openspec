# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `anexos_fiscais` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [ ] 2.1 `GET /api/anexos_fiscais` paginado com buscapor `anexo`; teste de paginação.
- [ ] 2.2 `POST /api/anexos_fiscais` validando o corpo (obrigatórios: `anexo`); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/anexos_fiscais/:id`, `PUT /api/anexos_fiscais/:id`, `DELETE /api/anexos_fiscais/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/anexos_fiscais`: tabela com as colunas de lista (`anexo`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/anexos_fiscais/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/anexos_fiscais/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/anexos-fiscais/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 013-anexos-fiscais --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
