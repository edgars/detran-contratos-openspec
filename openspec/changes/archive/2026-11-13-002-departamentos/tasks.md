# Tasks

## 1. Modelo de dados

- [x] 1.1 Migração criando `departamentos` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.
- [x] 1.2 FK `diretoriaId` → `Diretorias`; teste de integridade.

## 2. API

- [x] 2.1 `GET /api/departamentos` paginado com buscapor `diretoriaId`; teste de paginação.
- [x] 2.2 `POST /api/departamentos` validando o corpo (obrigatórios: `diretoriaId`, `id`, `deDepartamento`); teste rejeitando corpo inválido com `400`.
- [x] 2.3 `GET /api/departamentos/:id`, `PUT /api/departamentos/:id`, `DELETE /api/departamentos/:id`; testes de cada verbo.

## 3. Telas

- [x] 3.1 Página `/departamentos`: tabela com as colunas de lista (`diretoriaId`), busca e paginação, botão *Novo*.
- [x] 3.2 Formulário `/departamentos/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [x] 3.3 Formulário `/departamentos/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).
- [x] 3.4 Select de `diretoriaId` carregado de `/api/diretorias` exibindo `codigo`.
- [x] 3.5 Máscaras em `/departamentos`: `cep` `#####-###`; testar um valor fora de cada máscara.

## 4. Verificação

- [x] 4.1 Um teste por `#### Scenario:` de `specs/departamentos/spec.md`, todos verdes.
- [x] 4.2 `openspec validate 002-departamentos --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
