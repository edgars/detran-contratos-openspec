# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `tipo_contrato` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [x] 2.1 `GET /api/tipo_contratos` paginado com buscapor `nome`, `gerenciamento`; teste de paginação.
- [x] 2.2 `POST /api/tipo_contratos` validando o corpo (obrigatórios: `gerenciamento`); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/tipo_contratos/:id`, `PUT /api/tipo_contratos/:id`, `DELETE /api/tipo_contratos/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/tipo_contratos`: tabela com as colunas de lista (`nome`, `gerenciamento`), busca e paginação, botão *Novo*.
- [x] 3.2 Formulário `/tipo_contratos/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [x] 3.3 Formulário `/tipo_contratos/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [x] 4.1 Um teste por `#### Scenario:` de `specs/tipo-contratos/spec.md`, todos verdes.
- [x] 4.2 `openspec validate 003-tipo-contratos --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
