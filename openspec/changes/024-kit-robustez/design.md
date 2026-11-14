# Design — 024-kit-robustez

## Context

O kit de CRUD (`src/lib/crud/server.ts`) foi escrito na 009 como modelo e reaproveitado por 15 entidades. Os defeitos abaixo foram registrados pelos agentes nos `design.md` arquivados e no relatório da construção (PR das changes 001b–018, "Limitações conhecidas"). Cada um vira um requirement testável em `specs/crud-kit/spec.md` ou `specs/security/spec.md`.

| # | Defeito | Onde foi registrado | Contorno atual |
|---|---|---|---|
| D1 | PDF órfão quando a validação falha depois do upload | `017-contratos/design.md` › Open Questions › "Arquivo órfão"; relatório da construção | nenhum |
| D2 | PDF antigo não removido na troca | `013-anexos-fiscais/design.md` › "Edição sem arquivo novo" | nenhum |
| D3 | Exclusão sem `beforeDelete`; anexos do contrato órfãos | `017-contratos/design.md` › Open Questions › "Exclusão"; `011-status/design.md` (409 manual) | `status.server.ts` checa uso à mão |
| D4 | `UploadError` sem nome de campo (kit devolve `errors._`) | `crud/server.ts:70` | cada entidade reembrulha em `FieldRuleError` |
| D5 | `prepare` sem o registro atual | `013-anexos-fiscais/design.md` (relê o banco no `prepare`) | `prepareAnexoFiscal` faz `findUnique` |
| D6 | `listWhere` síncrono | `historicos.server.ts` (`_q`, `_contratos`) | parâmetros internos forjáveis |
| D7 | `searchFields` quebra em coluna numérica | `status.server.ts:26`, `contrato_status.server.ts:29` | busca reescrita em `listWhere` |
| D8 | Ordenação só fixa | `017-contratos/design.md` › "Lista com filtros próprios" | lista própria de contratos |
| D9 | `optionalString()` não limpa campo na edição | `002-departamentos/design.md`, `006-pagamentos/design.md` | `clearableString` copiado; remendo em `status.server.ts:35` |
| D10 | `P2002` | `crud/server.ts:74` — **já tratado** (`409 { error: "Já existe um registro com esse valor" }`) | falta teste |
| D11 | `publicUser` só limpa o primeiro nível | `auth/session.ts:10` | `historicos` usa `select` manual |

Conferência do D10: `handleError` em `src/lib/crud/server.ts` (linhas 74–76) converte `code === "P2002"` em `409`. Hoje a única coluna `@unique` do schema é `users.username`, e `users` checa duplicidade antes (`assertUniqueUsername`), por isso o caminho não tem teste. A change só acrescenta o teste (com delegate falso que lança `P2002`).

## Goals / Non-Goals

**Goals**
- Nenhum PDF novo fica no disco sem uma linha do banco que o referencie (D1, D2, D3).
- Os contornos das entidades saem; cada defeito é corrigido uma vez, no kit.
- Ganchos que 020–023 vão precisar: `beforeDelete`, `listWhere` assíncrono com `user`, `prepare` com `current`, `sortFields`.

**Non-Goals**
- Mudar o formato da API além de: parâmetro `sort` novo e erro de upload no campo.
- Limpar órfãos antigos do disco (ver proposal › Fora de escopo).
- Autorização por perfil (023).

## Decisions

- **Exclusão de contrato fica na 020** (ajuste de integração, 13/11/2026): esta change entrega só o gancho genérico `beforeDelete` e a remoção de arquivos depois do commit. A política de exclusão do contrato — o que bloqueia com `409` e o que é apagado junto — é definida por `020-contratos-complementos` › "Excluir Contratos" e prevalece sobre a tabela "Exclusão com beforeDelete" abaixo para a linha `contratos`.

- **Adiantado para 020/021** (pedido do coordenador da onda 2, 13/11/2026, para 020 e 021 não editarem o kit em paralelo):
  - `EntityList` › props opcionais `pageSize` (padrão 20; a API limita a 100) e `extraParams` (objeto de parâmetros fixos somados à query da lista, não exibidos como filtro) — usadas pela 021.
  - `FieldDef.maxLength` (em `src/components/crud/types.ts`): aplica `maxLength` nos campos `text`, `textarea` e `password` e mostra um contador discreto (`n/máx`, com texto para leitor de tela) a partir de 80% do limite — usado pela 020.
  - `EntityForm` › prop `deleteDescription` (texto do diálogo de exclusão; padrão: o aviso atual) — usada pela 020.
- **`fileFields` saem do schema validado**: o kit tira do schema (`omit`) os campos de `fileFields` e os acrescenta a `data` depois da validação. Assim vale tanto para `anexos_fiscais` (que mantém `anexo: anexoFiscalFields.anexo` no schema exportado, com `RK-9da08201400b`/`RK-0e70b6c81ee9`) quanto para `anexos_publicacaos`/`penalidades` (campo fora do schema). Na API, a obrigatoriedade do anexo é o `required: true` de `fileFields`.
- **Texto no lugar do arquivo → `400` no campo** ("Envie o arquivo em PDF"), como manda a tarefa 2.1. Antes, em `anexos_fiscais`, `anexos_publicacaos` e `penalidades`, o texto era ignorado em silêncio; os testes antigos que esperavam `200` foram atualizados (`tests/anexos_fiscais.test.ts` › "edição não aceita nome de arquivo…", `tests/anexos_publicacaos.test.ts` e `tests/penalidades.test.ts` › "Alterar um registro"). O formulário nunca envia texto em campo `file`, então a tela não muda.
- **`searchTerms`** (acréscimo ao `CrudConfig`): termos extras somados ao `OR` da busca do kit. Usado por `contrato_status` para "sim"/"não" → `atendido` 1/0, que o design pede "somado ao `OR` do kit" — um `listWhere` entra com `AND` e não serviria.
- **Ordenação da lista de contratos**: o select "Ordenar por" dos filtros de `/contratos` saiu; a ordenação passa a ser pelo cabeçalho (Nº do contrato, Data de vencimento, Valor total). A API continua aceitando `sort=campo&dir=desc`.
- **`sort` na URL da página**: os outros filtros do `EntityList` não ficam na URL (só em estado); o `sort` é lido de `window.location` ao abrir e gravado com `history.replaceState`, sem `useSearchParams` (evita exigir `Suspense` nas páginas).
- **Cópias de `clearableString`** também saíram de `modalidades.server.ts` e `situacao_contratuals.server.ts` (mesma semântica de `optionalString`). `pagamentos.server.ts` perdeu o laço `OPTIONAL_KEYS` (que transformava ausente em `null`): agora ausente não altera e vazio limpa; `mes`/`glosa` passaram a vazio → `null`. `status.periodo` passou a vazio → `null` (o bloco `OPTIONAL` saiu).
- **`src/lib/rules/schemas.ts`** (fora da lista do proposal): `contratoStatusFields.descricao` faz `transform` sobre `optionalString()`; como agora pode vir `null`, o `transform` passou a ignorar `null` além de `undefined`.

### Capability: `crud-kit` nova + `security` modificada

O comportamento do kit não está descrito em nenhuma spec: `app-shell` › "Convenções da API" fixa só o formato (`page`, `size`, `q`, `400` por campo), e `security` fixa só as garantias de segurança. Ganchos, busca, ordenação e campos apagáveis são comportamento comum de todas as entidades, mas não são segurança; colocá-los em `security` misturaria assuntos e tornaria a spec de segurança a dona de ordenação de lista. Por isso:

- **`crud-kit` (nova)**: tudo o que é mecânica do kit (D3–D10 e o mecanismo de D1/D2).
- **`security` (MODIFIED)**: só o que já era garantia de segurança e ficou incompleto — "Upload de PDF validado" (o arquivo não pode sobrar no disco; D1–D3) e "Senha guardada como hash" (nenhum nível da resposta; D11).

`app-shell` › "Convenções da API" não é modificada: o parâmetro `sort` é acréscimo opcional, descrito em `crud-kit`.

### Registro de arquivos da requisição (D1, D2)

Em `src/lib/uploads.ts`:

```ts
export class UploadError extends Error {
  constructor(message: string, public readonly field?: string) { super(message); }
}
export async function deleteStoredPdf(name: string): Promise<void>; // ignora nome fora de STORED_NAME e arquivo inexistente
export class UploadSession {
  saved: string[];           // gravados nesta requisição
  replaced: string[];        // a apagar depois do commit
  save(field: string, file: unknown, rule: AttachmentRule): Promise<string>; // savePdf + UploadError com field
  discard(name: string | null | undefined): void; // agenda o antigo para apagar após o commit
  rollback(): Promise<void>; // apaga `saved`
  commit(): Promise<void>;   // apaga `replaced`
}
```

`savePdf()` continua existindo (assinatura `%PDF-`, `UPLOAD_MAX_MB`, nome UUID, fora de `public/`) e é o único que grava; `UploadSession.save` chama `savePdf` e acrescenta `field` ao erro.

No kit (`save()`):

1. Cria `const files = new UploadSession()` e passa `ctx.files` ao `prepare`.
2. Se `config.fileFields` estiver definido, o próprio kit processa cada campo antes do `prepare` da entidade: `Blob` não vazio → `files.save(campo, blob, regra)`; vazio/ausente na edição → mantém o valor de `current`; texto no lugar do arquivo → `400` no campo ("Envie o arquivo em PDF"); na criação, campo com `required: true` sem arquivo → `UploadError(regra.missing, campo)`.
3. Qualquer erro entre o primeiro `save` e o fim da gravação no banco (validação `zod`, `FieldRuleError` no `beforeSave`, `P2002`/`P2003`, exceção) → `await files.rollback()` antes de responder.
4. Gravação confirmada → para cada `fileFields` cujo valor mudou, `files.discard(current[campo])`; depois `await files.commit()`.
5. Falha ao apagar o arquivo antigo é registrada em log (`console.warn` com o nome, sem conteúdo) e não desfaz a gravação (o arquivo sobra, mas o registro está correto).

Config:

```ts
fileFields?: Record<string, { rule: AttachmentRule; required?: boolean }>;
```

| Entidade | `fileFields` | Regras (`RK`) |
|---|---|---|
| `anexos_fiscais` | `anexo: { rule: ANEXO_FISCAL, required: true }` | `RK-01658245d11b`, `RK-23cdd0c37c3c` |
| `anexos_publicacaos` | `anexo: { rule: ANEXO_PUBLICACAO, required: true }` | `RK-9aa2ad64672e`, `RK-e2b53b79c3c2` |
| `penalidades` | `arquivo: { rule: ARQUIVO_PENALIDADE, required: true }` | `RK-174d58601890`, `RK-abb6ac79fad7` |
| `contratos` | `anexo: { rule: ANEXO_CONTRATO }` | `RK-ed7bc4aaba15` |

`anexoPublicacao` e `anexoFiscal` do formulário de contratos não são colunas de `contratos` (viram linhas em `anexos_publicacao`/`anexos_fiscais`): continuam no `prepare` de contratos, mas gravados por `ctx.files.save(...)`, de modo que o rollback do kit os alcança (`RK-295d296eb4f7`, `RK-b6f82ba63c1f`). Como cada envio cria uma linha nova, não há arquivo substituído para eles.

### Exclusão com `beforeDelete` (D3)

```ts
beforeDelete?: (current: unknown, ctx: { user: SessionUser; tx: Prisma.TransactionClient; files: UploadSession }) => Promise<void> | void;
```

`remove()` passa a: ler o registro (404 se não existe) → abrir `prisma.$transaction` → chamar `beforeDelete` → `delete` pelo cliente da transação → depois do commit, `files.commit()`. Os `fileFields` do registro excluído são agendados automaticamente (`files.discard`). O gancho pode lançar `ConflictError(mensagem)` (nova, em `crud/server.ts`) → `409 { error: mensagem }`.

Para o delegate rodar na transação, `CrudConfig.delegate` passa a aceitar `(tx?: Prisma.TransactionClient) => unknown`; as entidades trocam `() => prisma.x` por `(db = prisma) => db.x`.

Uso nas entidades:

| Entidade | `beforeDelete` |
|---|---|
| `contratos` | 1) aditivos (`parentId`) → `409` "Contrato com aditivos não pode ser excluído" (hoje o `P2003` já dá 409; passa a ser explícito). 2) Linhas em `fiscais`, `historicos`, `pagamentos`, `penalidades`, `prestacao_contas`, `contrato_status` com o `contratoId` → `409` "Contrato com registros vinculados não pode ser excluído" (essas tabelas não têm FK, e hoje ficariam órfãs). 3) Sem bloqueio: apaga as linhas de `anexos_publicacao` e `anexos_fiscais` do contrato e agenda os arquivos (`anexo`) para apagar, junto com `contratos.anexo`. |
| `status` | a checagem manual de uso por `contrato_status` (011) migra para o gancho (`409`, mesma mensagem). |
| `anexos_fiscais`, `anexos_publicacaos`, `penalidades` | nenhum gancho: o arquivo sai pelo `fileFields`. |

A decisão "anexos saem junto; outros vínculos bloqueiam" responde à Open Question da 017 de forma conservadora: anexo de publicação e de fiscalização só existem em função do contrato; os outros registros têm valor próprio (pagamento, penalidade) e não devem sumir sem decisão do autor (ver Open Questions).

### `prepare` com o registro atual (D5)

`prepare(raw, { user, id, mode, current, files })`. `current` é o objeto que `save()` já lê (`findUnique({ where: { id } })`). `prepareAnexoFiscal` deixa de consultar o banco (o caso "edição sem arquivo" passa a ser feito pelo kit via `fileFields`).

### `listWhere` assíncrono (D6)

```ts
listWhere?: (params: URLSearchParams, ctx: { user: SessionUser; q: string }) => object | undefined | Promise<object | undefined>;
```

O kit faz `await`. `historicos` passa a resolver a busca por número do contrato dentro do `listWhere` (`prisma.contrato.findMany({ where: { numeroContrato: { contains: q } }, select: { id: true } })`), e os parâmetros `_q`/`_contratos` deixam de existir: enviados pelo cliente, são ignorados. Quando o `listWhere` trata `q` sozinho, a entidade não declara `searchFields` (o kit não aplica duas buscas).

### Busca em colunas numéricas (D7)

```ts
searchFields?: (string | { field: string; type: "int" })[];
```

Texto → `{ [field]: { contains: q } }`. `type: "int"` → `{ [field]: Number(q) }` só se `q` casa com `/^-?\d+$/`; senão o campo fica fora do `OR`. Se nenhum campo sobrar, a lista volta vazia (nenhum registro casa com `q`) em vez de ignorar a busca. Aplicação: `status` (`periodo`, Int) e `contrato_status` (`atendido`, Int; o mapeamento "sim"/"não" → 1/0 continua no `listWhere` dessa entidade, que soma ao `OR` do kit). Nas outras entidades os campos de busca são `String` (conferido em `prisma/schema.prisma`: `fases.periodo`, `prestacao_contas.atendido`, `pagamentos.ano` são `String`).

### Ordenação escolhida (D8)

```ts
sortFields?: string[];          // colunas permitidas
orderBy?: object;               // padrão quando `sort` não vem ou não é permitido
```

`GET /api/<entidade>?sort=<campo>:asc|desc` (também `sort=<campo>&dir=desc`, formato que a lista de contratos já aceita). Campo fora de `sortFields` é ignorado (vale `orderBy`, padrão `{ id: "desc" }`); a ordem final sempre recebe `{ id: "desc" }` como desempate, para a paginação ser estável. Nenhum nome de coluna vem da requisição sem passar pela lista (`security` › "Gravação só de campos permitidos" e "Consultas parametrizadas").

Interface: `ColumnDef.sortable?: boolean`; `EntityList` mostra o cabeçalho dessas colunas como botão (`Button variant="ghost"` do shadcn/ui com ícone `ArrowUpDown`/`ArrowUp`/`ArrowDown`, `aria-sort` no `<th>`), alterna asc → desc e guarda `sort` na URL da página como os outros filtros. A lista de contratos volta a usar `list` do kit, com `listWhere: contratosWhere` e `sortFields: ["dataTermino", "numeroContrato", "valorTotal"]` (a mesma lista de `contratosOrderBy`, que sai).

### Campo opcional apagável (D9)

`optionalString()` em `src/lib/rules/fields.ts` passa a ser:

```ts
export const optionalString = () =>
  z.preprocess((v) => (v === undefined ? undefined : blank(v) ? null : v), z.string().trim().nullish());
```

Vazio/só espaços/`null` → `null` (apaga na edição); ausente → `undefined` (não altera). As cópias `clearableString` de `departamentos.server.ts` e `contratos.server.ts` passam a importar `optionalString`; o remendo de `status.server.ts` (`OPTIONAL` → `null`) sai. Revisão dos usos: `anexos_publicacaos.anexo` e `penalidades.arquivo` (`String?`, mas obrigatórios na inclusão por `RK-e2b53b79c3c2`/`RK-abb6ac79fad7`) saem do `optionalString` e passam a `fileFields` com `required: true`, e o kit grava o nome; `historicos.descricao`, `prestacao_contas.descricao`, `pagamentos.*` e `status.*` são `String?` (conferido em `prisma/schema.prisma`), então `null` é válido.

### Erro de upload no campo (D4)

`handleError`: `UploadError` com `field` → `400 { errors: { [field]: message } }`; sem `field` → `errors._` (compatível). Os `try/catch` que reembrulham em `FieldRuleError` (`uploadAnexo` em `anexos_fiscais.server.ts`, `uploadArquivo` em `penalidades.server.ts`, `prepareAnexos` em `contratos.server.ts`) saem. Os comentários `// RK-…` mudam de lugar junto com a chamada (`fileFields` de cada entidade).

### Campos de senha em qualquer nível (D11)

`src/lib/auth/session.ts`:

```ts
export const SECRET_FIELDS = ["password", "passwordHash", "passwordold", "passwordnew", "passwordconfirm"] as const;
export function stripSecrets<T>(value: T): T; // recursivo em objetos e arrays; preserva Date, Decimal, Buffer
export function publicUser(user) { return stripSecrets(user); }
```

O kit aplica `stripSecrets` a toda resposta (`list`, `get`, `create`, `update`) depois do `serialize` da entidade. `Decimal` (Prisma) e `Date` não são percorridos (são devolvidos como estão, para o `toJSON` atual continuar valendo).

### Conflito de valor único (D10)

Sem mudança de código: teste em `tests/crud-kit.test.ts` com delegate falso cujo `create` lança `{ code: "P2002" }` → `409 { error: "Já existe um registro com esse valor" }`, e checagem de que nenhum arquivo da requisição sobra (D1).

## Risks / Trade-offs

- [Apagar arquivo antes do commit perderia o anexo] → só se apaga o antigo **depois** do commit; na falha só se apagam os arquivos novos desta requisição.
- [Arquivo antigo referenciado por outra linha] → nomes são UUID gerados por `savePdf`, um por envio; nenhuma linha compartilha nome hoje. Mesmo assim `discard` só agenda nomes que casam com `STORED_NAME`, e `commit()` confere antes de apagar se o nome ainda aparece em alguma coluna de anexo (`contratos.anexo`, `anexos_fiscais.anexo`, `anexos_publicacao.anexo`, `penalidades.arquivo`; e `contratos.projetoBasico` quando a 020 o tornar PDF) — custo baixo, evita apagar arquivo compartilhado se a carga do legado (025) repetir nomes.
- [`optionalString` gravar `null` onde antes ignorava] → muda o comportamento do `PUT` sem o campo? Não: ausente continua `undefined`. Só muda quando o formulário envia vazio, que é o caso desejado. Testes de cada entidade que usa o helper rodam de novo.
- [Exclusão de contrato bloqueada por vínculos] → antes excluía e deixava órfãos; agora o operador recebe `409` com a mensagem e precisa excluir os vínculos. Registrado em Open Questions.
- [Mudança no formato de erro de upload] → só para quem recebia `errors._`; as telas leem `errors[campo]` e `errors._` (EntityForm mostra os dois), então não quebra.

## Open Questions

- **Vínculos do contrato na exclusão** — o legado apagava `fiscais`, `historicos`, `pagamentos`, `penalidades`, `prestacao_contas` e `contrato_status` junto com o contrato? Proposta desta change: apagar só os anexos (publicação e fiscais) e bloquear com `409` quando houver os outros. Confirmar com o autor (ou pelo MCP da RNC, `getSourceFile` em `contratos_controller.php` › `remover`).
- **Órfãos já existentes** — quantos PDFs sem referência existem hoje em `UPLOAD_DIR` no ambiente de homologação? Se houver, decidir se `026-producao` inclui uma rotina de limpeza.
- **`npm run build` não rodado nesta aplicação** (o briefing da onda proíbe `next build` durante o trabalho em paralelo): a tarefa 7.2 fica aberta só por esse item; `tsc` e `eslint` passam.
- **`contrato_status` ainda grava `null` em `descricao`/`atendido` ausentes no PUT** (bloco `OPTIONAL` dessa entidade, fora das tarefas desta change). Comportamento mantido; harmonizar com "ausente não altera" se o autor quiser.

