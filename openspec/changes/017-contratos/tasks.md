# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `contratos` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.
- [ ] 1.2 FK `tipoContratoId` → `TipoContrato`; teste de integridade.
- [ ] 1.3 FK `modalidadeId` → `Modalidades`; teste de integridade.
- [ ] 1.4 FK `situacaoContratualId` → `SituacaoContratual`; teste de integridade.
- [ ] 1.5 FK `prestadorServicoId` → `PrestadoresServicos`; teste de integridade.
- [ ] 1.6 FK `situacaoContratual` → `SituacaoContratual`; teste de integridade.

## 2. API

- [ ] 2.1 `GET /api/contratos` paginado com buscapor `busca`, `tipoContratoId`, `modalidadeId`, `campo`, `ordenar`; teste de paginação.
- [ ] 2.2 `POST /api/contratos` validando o corpo (obrigatórios: `tipoContratoId`); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/contratos/:id`, `PUT /api/contratos/:id`, `DELETE /api/contratos/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/contratos`: tabela com as colunas de lista (`busca`, `tipoContratoId`, `modalidadeId`, `campo`, `ordenar`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/contratos/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/contratos/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).
- [ ] 3.4 Select de `tipoContratoId` carregado de `/api/tipo_contratos` exibindo `nome`.
- [ ] 3.5 Select de `modalidadeId` carregado de `/api/modalidades` exibindo `nome`.
- [ ] 3.6 Select de `situacaoContratualId` carregado de `/api/situacao_contratual` exibindo `id`.
- [ ] 3.7 Select de `prestadorServicoId` carregado de `/api/prestadores_servicos` exibindo `id`.
- [ ] 3.8 Select de `situacaoContratual` carregado de `/api/situacao_contratual` exibindo `id`.

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/contratos/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 017-contratos --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
