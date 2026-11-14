# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `historicos` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.
- [x] 1.2 FK `contratoId` → `Contratos`; teste de integridade. (Modelo sem FK declarada: integridade conferida na API — 400 "Contrato não encontrado", testado.)
- [x] 1.3 FK `usuarioId` → `Users`; teste de integridade.

## 2. API

- [x] 2.1 `GET /api/historicos` paginado com buscapor `contratoId`; teste de paginação.
- [x] 2.2 `POST /api/historicos` validando o corpo (obrigatórios: `contratoId`, `id`); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/historicos/:id`, `PUT /api/historicos/:id`, `DELETE /api/historicos/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/historicos`: tabela com as colunas de lista (`contratoId`), busca e paginação, botão *Novo*.
- [x] 3.2 Formulário `/historicos/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [x] 3.3 Formulário `/historicos/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).
- [x] 3.4 Select de `contratoId` carregado de `/api/contratos` exibindo `numeroProcesso`. (Exibe `numeroContrato` — ver design.md §Decisions.)
- [ ] 3.5 Select de `usuarioId` carregado de `/api/users` exibindo `id`. (Não feito: `usuarioId` é o usuário da sessão, read-only — ver design.md §Decisions.)

## 4. Verificação

- [x] 4.1 Um teste por `#### Scenario:` de `specs/historicos/spec.md`, todos verdes.
- [x] 4.2 `openspec validate 012-historicos --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
