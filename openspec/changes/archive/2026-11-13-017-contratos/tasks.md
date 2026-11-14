# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `contratos` com as colunas de `001-project-foundation/design.md` › Contratos, valores em `Decimal`; entidade no Prisma. Verificação: `prisma migrate dev` aplica sem erro.
- [x] 1.2 FKs `tipoContratoId` → `TipoContrato`, `modalidadeId` → `Modalidades`, `departamentoId` → `Departamentos`, `prestadorServicoId` → `PrestadoresServicos`, `situacaoContratualId` → `SituacaoContratual`, `parentId` → `Contratos`; teste de integridade de cada FK.

## 2. API

- [x] 2.1 `GET /api/contratos` paginado com os filtros de `design.md` § Filtros da lista; testes de paginação, de `q` e de `vencendoEm`.
- [x] 2.2 `POST /api/contratos` com schema `zod` `.strict()` (helper de `001b-security-baseline`); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/contratos/:id`, `PUT /api/contratos/:id`, `DELETE /api/contratos/:id`; testes de cada verbo.
- [x] 2.4 `POST /api/contratos/:id/aditivos` criando contrato filho; teste do cenário *Criar aditivo*.

## 3. Telas

- [x] 3.1 Página `/contratos`: tabela com as colunas de lista de `design.md`, filtros, ordenação, paginação e botão *Novo*; teste do cenário *Abrir a lista*.
- [x] 3.2 Formulário `/contratos/new` com os campos na ordem de `design.md`, obrigatórios com erro inline; teste do cenário *Salvar um contrato válido*.
- [x] 3.3 Formulário `/contratos/[id]/edit` pré-preenchido, com salvar e excluir (confirmação); teste dos cenários de edição e exclusão.
- [x] 3.4 Página `/contratos/[id]` com os aditivos do contrato e o botão *Novo aditivo*; teste manual abrindo um contrato com aditivo.
- [x] 3.5 Selects de `tipoContratoId`, `modalidadeId`, `departamentoId`, `prestadorServicoId` e `situacaoContratualId`, e busca (`command`) de `pessoaFisicaId` e `suplenteId`; um teste por lookup.

## 4. Regras de negócio

- [x] 4.1 Enforce `RK-79134600b4be` — Informe o tipo de contrato; no schema `zod` de contratos, comentário `// RK-79134600b4be`; teste *Salvar sem tipo*.
- [x] 4.2 Enforce `RK-776d8b62d6df` — Informe o número do processo; no schema de contratos, comentário `// RK-776d8b62d6df`; teste do cenário.
- [x] 4.3 Enforce `RK-04fd1cbfc346` — Informe o número do contrato; no schema de contratos, comentário `// RK-04fd1cbfc346`; teste do cenário.
- [x] 4.4 Enforce `RK-6b2806cfff8d` — Informe a data de início; no schema de contratos, comentário `// RK-6b2806cfff8d`; teste do cenário.
- [x] 4.5 Enforce `RK-9d6599f5897d` — Informe a data de vencimento; no schema de contratos, comentário `// RK-9d6599f5897d`; teste do cenário.
- [x] 4.6 Enforce `RK-a0660a4fb262` — Informe o departamento(unidade gestora); no schema de contratos, comentário `// RK-a0660a4fb262`; teste do cenário.
- [x] 4.7 Enforce `RK-37f294a3dc8e` — Informe o fornecedor; no schema de contratos, comentário `// RK-37f294a3dc8e`; teste do cenário.
- [x] 4.8 Enforce `RK-5c46553fce3d` e `RK-260f6b933f77` — conversão de `valorTotal` e `valorMensal` para `Decimal` no handler de gravação, comentários `// RK-5c46553fce3d` e `// RK-260f6b933f77`; teste *Valor em formato brasileiro*.
- [x] 4.9 Enforce `RK-c3fbde6dbf4a` — `valorInicial = valorTotal` sem `parentId`, no serviço de gravação, comentário `// RK-c3fbde6dbf4a`; testes *Contrato original* e *Aditivo*.
- [x] 4.10 Enforce `RK-295d296eb4f7` e `RK-b6f82ba63c1f` — anexos de publicação e fiscal via `savePdf()`, comentários `// RK-295d296eb4f7` e `// RK-b6f82ba63c1f`; teste *Anexo que não é PDF*.

## 5. Verificação

- [x] 5.1 Um teste por `#### Scenario:` de `specs/contratos/spec.md`, todos verdes.
- [x] 5.2 `openspec validate 017-contratos --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
