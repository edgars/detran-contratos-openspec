# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `fiscais` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [x] 2.1 `GET /api/fiscais` paginado com buscapor `busca`, `pessoaFisicaCpf`, `suplente`, `presidente`; teste de paginação.
- [x] 2.2 `POST /api/fiscais` validando o corpo (obrigatórios: `pessoaFisicaCpf`, `suplente`, `presidente`); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/fiscais/:id`, `PUT /api/fiscais/:id`, `DELETE /api/fiscais/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/fiscais`: tabela com as colunas de lista (`busca`, `pessoaFisicaCpf`, `suplente`, `presidente`), busca e paginação, botão *Novo*.
- [x] 3.2 Formulário `/fiscais/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [x] 3.3 Formulário `/fiscais/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).
- [x] 3.4 Máscaras em `/fiscais`: `busca` `###.###.###-##`, `pessoaFisicaCpf` `###.###.###-##`; testar um valor fora de cada máscara.

## 4. Verificação

- [x] 4.1 Um teste por `#### Scenario:` de `specs/fiscais/spec.md`, todos verdes.
- [x] 4.2 `openspec validate 010-fiscais --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
