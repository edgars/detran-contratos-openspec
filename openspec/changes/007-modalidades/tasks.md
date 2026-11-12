# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `modalidades` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [ ] 2.1 `GET /api/modalidades` paginado com buscapor `nome`; teste de paginação.
- [ ] 2.2 `POST /api/modalidades` validando o corpo (obrigatórios: nenhum); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/modalidades/:id`, `PUT /api/modalidades/:id`, `DELETE /api/modalidades/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/modalidades`: tabela com as colunas de lista (`nome`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/modalidades/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/modalidades/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/modalidades/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 007-modalidades --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
