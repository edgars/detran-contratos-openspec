# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `prestacao_contas` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [ ] 2.1 `GET /api/prestacao_contas` paginado com buscapor `descricao`, `atendido`; teste de paginação.
- [ ] 2.2 `POST /api/prestacao_contas` validando o corpo (obrigatórios: nenhum); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/prestacao_contas/:id`, `PUT /api/prestacao_contas/:id`, `DELETE /api/prestacao_contas/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/prestacao_contas`: tabela com as colunas de lista (`descricao`, `atendido`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/prestacao_contas/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/prestacao_contas/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/prestacao-contas/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 008-prestacao-contas --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
