# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `contrato_status` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [ ] 2.1 `GET /api/contrato_status` paginado com buscapor `descricao`, `atendido`; teste de paginação.
- [ ] 2.2 `POST /api/contrato_status` validando o corpo (obrigatórios: nenhum); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/contrato_status/:id`, `PUT /api/contrato_status/:id`, `DELETE /api/contrato_status/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/contrato_status`: tabela com as colunas de lista (`descricao`, `atendido`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/contrato_status/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/contrato_status/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/contrato-status/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 004-contrato-status --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
