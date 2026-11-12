# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `fases` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [ ] 2.1 `GET /api/fases` paginado com buscapor `nome`, `periodo`; teste de paginação.
- [ ] 2.2 `POST /api/fases` validando o corpo (obrigatórios: `nome`, `periodo`); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/fases/:id`, `PUT /api/fases/:id`, `DELETE /api/fases/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/fases`: tabela com as colunas de lista (`nome`, `periodo`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/fases/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/fases/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/fases/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 009-fases --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
