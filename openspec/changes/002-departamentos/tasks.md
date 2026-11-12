# Tasks

## 1. Modelo de dados

- [ ] 1.1 Migração criando `departamentos` com as colunas de `design.md` (tipos e nulidade); entidade/modelo no ORM.
- [ ] 1.2 FK `diretoriaId` → `Diretorias`; teste de integridade.

## 2. API

- [ ] 2.1 `GET /api/departamentos` paginado com buscapor `diretoriaId`; teste de paginação.
- [ ] 2.2 `POST /api/departamentos` validando o corpo (obrigatórios: `diretoriaId`, `id`, `deDepartamento`); teste rejeitando corpo inválido com `400`.
- [ ] 2.3 `GET /api/departamentos/:id`, `PUT /api/departamentos/:id`, `DELETE /api/departamentos/:id`; testes de cada verbo.

## 3. Telas

- [ ] 3.1 Página `/departamentos`: tabela com as colunas de lista (`diretoriaId`), busca e paginação, botão *Novo*.
- [ ] 3.2 Formulário `/departamentos/new` com os campos na ordem de `design.md`; obrigatórios com erro inline.
- [ ] 3.3 Formulário `/departamentos/[id]/edit` pré-preenchido, com salvar e excluir (confirmação).
- [ ] 3.4 Select de `diretoriaId` carregado de `/api/diretorias` exibindo `codigo`.
- [ ] 3.5 Máscaras em `/departamentos`: `cep` `#####-###`; testar um valor fora de cada máscara.

## 4. Verificação

- [ ] 4.1 Um teste por `#### Scenario:` de `specs/departamentos/spec.md`, todos verdes.
- [ ] 4.2 `openspec validate 002-departamentos --strict` passa; com o MCP da RNC conectado, `getRule` conferido para cada `RK-…` acima.
