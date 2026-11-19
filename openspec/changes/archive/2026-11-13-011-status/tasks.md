# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `status` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [x] 2.1 `GET /api/status` paginado com buscapor `nome`, `fluxo`, `periodo`; teste de paginação.
- [x] 2.2 `POST /api/status` validando o corpo (obrigatórios: nenhum); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/status/:id`, `PUT /api/status/:id`, `DELETE /api/status/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/status`: tabela com as colunas de lista (`nome`, `fluxo`, `periodo`), busca e paginação, botão *Novo*.
- [x] 3.2 Formulário `/status/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [x] 3.3 Formulário `/status/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Regras de negócio

- [x] 4.1 Enforce `RK-a7017eb6c42d` — status_id is required; comentário `// RK-a7017eb6c42d` no ponto do código onde a regra vale.
- [x] 4.2 Enforce `RK-067d06861847` — status_id is required; comentário `// RK-067d06861847` no ponto do código onde a regra vale.

## 5. Verificação

- [x] 5.1 Um teste por `#### Scenario:` de `specs/status/spec.md`, todos verdes.
- [x] 5.2 `openspec validate 011-status --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
