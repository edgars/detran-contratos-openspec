# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `pagamentos` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.

## 2. API

- [ ] 2.1 `GET /api/pagamentos` paginado com buscapor `numeroProcesso`, `ano`, `notaFiscal`, `empenho`, `notaLiquidacao`; teste de paginação.
- [ ] 2.2 `POST /api/pagamentos` validando o corpo (obrigatórios: `numeroProcesso`); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/pagamentos/:id`, `PUT /api/pagamentos/:id`, `DELETE /api/pagamentos/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/pagamentos`: tabela com as colunas de lista (`numeroProcesso`, `ano`, `notaFiscal`, `empenho`, `notaLiquidacao`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/pagamentos/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/pagamentos/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/pagamentos/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 006-pagamentos --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
