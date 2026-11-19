# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `anexos_publicacao` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [x] 2.1 `GET /api/anexos_publicacaos` paginado com buscapor `anexo`; teste de paginação.
- [x] 2.2 `POST /api/anexos_publicacaos` validando o corpo (obrigatórios: nenhum); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/anexos_publicacaos/:id`, `PUT /api/anexos_publicacaos/:id`, `DELETE /api/anexos_publicacaos/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/anexos_publicacaos`: tabela com as colunas de lista (`anexo`), busca e paginação, botão *Novo*.
- [x] 3.2 Formulário `/anexos_publicacaos/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [x] 3.3 Formulário `/anexos_publicacaos/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [x] 4.1 Um teste por `#### Scenario:` de `specs/anexos-publicacaos/spec.md`, todos verdes.
- [x] 4.2 `openspec validate 015-anexos-publicacaos --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
