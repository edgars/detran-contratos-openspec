# Tasks

## 1. Uploads com ciclo de vida (D1, D2, D4)

- [ ] 1.1 Em `src/lib/uploads.ts`: `UploadError(message, field?)`, `deleteStoredPdf(name)` (só nomes que casam com `STORED_NAME`; arquivo inexistente não é erro) e a classe `UploadSession` (`save`, `discard`, `rollback`, `commit`) de `design.md` › "Registro de arquivos da requisição"; `commit()` só apaga nome que não aparece mais em `contratos.anexo`, `anexos_fiscais.anexo`, `anexos_publicacao.anexo` nem `penalidades.arquivo`. Verificação: `tests/uploads.test.ts` (novo) — `save` grava e devolve nome UUID; `rollback` apaga os gravados; `commit` apaga os descartados; `discard` de nome ainda referenciado não apaga; `UploadError.field` preenchido.
- [ ] 1.2 Em `src/lib/crud/server.ts` › `handleError`: `UploadError` com `field` → `400 { errors: { [field]: message } }`; sem `field` → `errors._`. Verificação: teste do cenário *PDF inválido em penalidade* em `tests/crud-kit.test.ts` (`errors.arquivo` presente, `errors._` ausente).

## 2. Gravação no kit (D1, D2, D5)

- [ ] 2.1 `CrudConfig.fileFields` e o processamento automático dos campos de arquivo em `save()` (Blob → `files.save`; vazio na edição → mantém `current`; texto → `400` "Envie o arquivo em PDF"; `required` sem arquivo na criação → `UploadError(rule.missing, campo)`). Verificação: testes *Edição sem arquivo novo* e *Arquivo ausente na inclusão* em `tests/crud-kit.test.ts`.
- [ ] 2.2 `save()` envolve validação, `beforeSave` e gravação num `try`; em qualquer erro chama `files.rollback()` antes de `handleError`; no sucesso agenda `files.discard(current[campo])` para cada `fileFields` alterado e chama `files.commit()` depois da gravação. Verificação: testes dos cenários *Validação falha depois do upload*, *Erro do banco depois do upload*, *Trocar o PDF de um anexo fiscal* e *Edição que falha não perde o anexo* (contam os arquivos de `UPLOAD_DIR` apontado para uma pasta temporária por teste).
- [ ] 2.3 `prepare(raw, { user, id, mode, current, files })`: `current` é o objeto já lido por `save()`. Verificação: teste *Prepare na edição* com delegate falso que conta chamadas de `findUnique` (exatamente 1).
- [ ] 2.4 `CrudConfig.delegate` aceita `(tx?) => …`; trocar `() => prisma.x` por `(db = prisma) => db.x` em todos os `src/lib/entities/*.server.ts`. Verificação: `npx tsc --noEmit` sem erros e `npm test` verde.

## 3. Exclusão (D3)

- [ ] 3.1 `remove()` em transação: lê o registro (404), chama `beforeDelete(current, { user, tx, files })`, apaga pelo `tx`, agenda os `fileFields` do registro e chama `files.commit()` depois do commit; nova `ConflictError` → `409 { error }`. Verificação: teste *Gancho recusa a exclusão* e teste de que, com `beforeDelete` lançando, o arquivo do registro continua no disco.
- [ ] 3.2 `contratos.server.ts`: nenhuma regra de exclusão de contrato aqui — a política (bloqueios, o que é apagado junto, mensagem) é da `020-contratos-complementos` › "Excluir Contratos", que passa a usar o `beforeDelete` desta change. Verificação: `rg "beforeDelete" src/lib/entities/contratos.server.ts` vazio ao fim desta change.
- [ ] 3.3 `status.server.ts`: a checagem de uso por `contrato_status` passa para `beforeDelete` (mesma mensagem e `409`). Verificação: teste existente de exclusão de Status em uso continua verde em `tests/status.test.ts`.
- [ ] 3.4 `anexos_fiscais`, `anexos_publicacaos`, `penalidades`: declarar `fileFields` para que a exclusão apague o arquivo. Verificação: teste *Excluir um anexo de publicação* e cenário *Exclusão de registro com anexo* (`security`, requisito *PDF sem referência apagado do disco*) em `tests/security.test.ts`.

## 4. Entidades com anexo migram para `fileFields` (D1, D2, D4)

- [ ] 4.1 `anexos_fiscais.server.ts`: `fileFields: { anexo: { rule: ANEXO_FISCAL, required: true } }`; remover `uploadAnexo` e o `findUnique` de `prepareAnexoFiscal`; mover os comentários `// RK-01658245d11b` e `// RK-23cdd0c37c3c` para a declaração de `fileFields`. Verificação: `tests/anexos_fiscais.test.ts` verde; `npm test -- rk-coverage` verde (as duas chaves continuam com comentário).
- [ ] 4.2 `anexos_publicacaos.server.ts`: `fileFields: { anexo: { rule: ANEXO_PUBLICACAO, required: true } }`, `anexo` sai do schema `zod`; comentários `// RK-9aa2ad64672e` e `// RK-e2b53b79c3c2` na declaração. Verificação: `tests/anexos_publicacaos.test.ts` e teste *Arquivo ausente na inclusão*.
- [ ] 4.3 `penalidades.server.ts`: `fileFields: { arquivo: { rule: ARQUIVO_PENALIDADE, required: true } }`, `arquivo` sai do schema `zod`; comentários `// RK-174d58601890` e `// RK-abb6ac79fad7` na declaração. Verificação: `tests/penalidades.test.ts` e cenário *Troca de anexo* (`security`, requisito *PDF sem referência apagado do disco*).
- [ ] 4.4 `contratos.server.ts`: `fileFields: { anexo: { rule: ANEXO_CONTRATO } }` (`// RK-ed7bc4aaba15`); `anexoPublicacao`/`anexoFiscal` gravados no `prepare` por `ctx.files.save(campo, arquivo, regra)` (`// RK-295d296eb4f7`, `// RK-b6f82ba63c1f`), sem `try/catch` de reembrulho. Verificação: cenário *Segundo anexo inválido na mesma requisição* em `tests/contratos.test.ts`; `rk-coverage` verde.

## 5. Lista: filtro, busca e ordenação (D6, D7, D8)

- [ ] 5.1 `listWhere(params, { user, q })` com `await` no kit. Verificação: teste unitário com `listWhere` assíncrono em `tests/crud-kit.test.ts`.
- [ ] 5.2 `historicos.server.ts`: busca por número do contrato dentro do `listWhere`; remover `_q`/`_contratos` da rota e do kit. Verificação: cenários *Buscar históricos pelo número do contrato* e *Parâmetro interno forjado* em `tests/historicos.test.ts`.
- [ ] 5.3 `searchFields` com `{ field, type: "int" }`; `status` declara `["nome", "fluxo", { field: "periodo", type: "int" }]` e perde a busca do `listWhere`; `contrato_status` declara `{ field: "atendido", type: "int" }` e mantém só o mapeamento "sim"/"não". Verificação: cenários *Texto em coluna numérica* e *Número em coluna numérica* em `tests/status.test.ts`; teste de `contrato_status` com `q=abc` → 200.
- [ ] 5.4 `sortFields` e parâmetro `sort` no kit, com desempate `id desc`. Verificação: cenários *Ordenar contratos pelo vencimento* e *Campo não permitido* em `tests/crud-kit.test.ts`.
- [ ] 5.5 `contratos.server.ts`: a lista volta a ser o `list` do kit com `listWhere: contratosWhere` e `sortFields: ["dataTermino", "numeroContrato", "valorTotal"]`; `contratosOrderBy` e a função `list` própria saem. Verificação: testes existentes de lista, `q` e `vencendoEm` em `tests/contratos.test.ts` continuam verdes.
- [ ] 5.6 `ColumnDef.sortable` e cabeçalho clicável no `EntityList` (`Button variant="ghost"` do shadcn/ui, `aria-sort`, `sort` na URL); marcar como `sortable` as colunas cujo campo está em `sortFields` de cada entidade (`src/lib/entities/*.ts`). Verificação: teste de componente do cenário *Clicar no cabeçalho* (Testing Library) ou, se o projeto seguir sem testes de interface, checagem manual em `/contratos` registrada no PR.

## 6. Campos opcionais e respostas (D9, D10, D11)

- [ ] 6.1 `optionalString()` em `src/lib/rules/fields.ts` com a semântica vazio → `null`, ausente → `undefined`; remover `clearableString` de `departamentos.server.ts` e `contratos.server.ts` (importam `optionalString`) e o bloco `OPTIONAL` de `status.server.ts`. Verificação: cenários *Limpar um campo opcional* (`tests/pagamentos.test.ts`) e *Campo ausente no corpo* (`tests/departamentos.test.ts`); `npm test` verde.
- [ ] 6.2 `stripSecrets()` recursivo em `src/lib/auth/session.ts` (preserva `Date` e `Decimal`), `publicUser` passa a usá-lo e o kit o aplica a toda resposta depois do `serialize`. Verificação: cenário *Usuário aninhado em outro registro* (requisito *Campos de senha removidos em qualquer nível*) em `tests/security.test.ts` (entidade de teste com `include: { usuario: true }`); teste de que `valorTotal` continua serializado como antes.
- [ ] 6.3 Teste do `409` para `P2002` (já tratado em `src/lib/crud/server.ts:74`, sem mudança de código). Verificação: cenário *Gravação com valor único repetido* em `tests/crud-kit.test.ts`.

## 7. Verificação

- [ ] 7.1 Um teste por `#### Scenario:` de `specs/crud-kit/spec.md` e `specs/security/spec.md`, todos verdes (`npm test`).
- [ ] 7.2 `npx tsc --noEmit`, `npm run lint` e `npm run build` sem erros.
- [ ] 7.3 `OPENSPEC_TELEMETRY=0 npx -y @fission-ai/openspec@latest validate 024-kit-robustez --strict` passa.
