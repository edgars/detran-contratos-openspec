# Design

## Context

Evidência do legado (`docs/legado/chaves-pessoas-fornecedores.md`, lida do MCP da RNC em 13/11/2026):

| Legado | Guarda | Tela |
|---|---|---|
| `contratos.pessoa_fisica_id` | CPF (`PessoaFisica.CPF = Contrato.pessoa_fisica_id`) | "Gestor", maxLength 11, "Busca (CPF ou Nome)" |
| `contratos.suplente_id` | CPF | "Gestor Suplente", maxLength 11, "Busca (CPF ou Nome)" |
| `contratos.prestador_servico_id` | CNPJ (`PrestadorServico.CNPJ = Contrato.prestador_servico_id`) | "Fornecedor", maxLength 14, exibe `DeRazaoSocial` |
| `fiscais.pessoa_fisica_CPF` | CPF (HABTM `Fiscais`) | — |
| `global.pessoas_fisicas`, `global.prestadores_servicos` | banco `global`, compartilhado com outros sistemas do DETRAN-RJ | — |

`docs/legado/relatorios.md` confirma as mesmas junções nos relatórios (019).

Estado atual do app (código lido em 13/11/2026):

- `prisma/schema.prisma`: `PessoaFisica` sem `cpf` (tem `idPessoaFisica Int`); `PrestadorServico` só `id` e `deRazaoSocial`; `Contrato.pessoaFisicaId`/`suplenteId` são `String?` e hoje recebem `idPessoaFisica` em texto (`src/lib/entities/contratos.ts`, `pessoaFisicaLookup`); `Contrato.prestadorServicoId Int?` com relação `prestadorServico`; `Fiscal.pessoaFisicaCpf String` gravado **com máscara** `###.###.###-##` (`src/lib/entities/fiscais.server.ts`, `maskedString(MASKS.cpf, …)`).
- `src/lib/reference/tables.ts`: `q` procura só em `deNome`/`deRazaoSocial` (`contains`), ordena por `id`, devolve todas as colunas (as ~59 de `pessoas_fisicas`, incluindo endereço, filiação e nascimento).
- `src/components/crud/use-options.ts`: busca `?size=100` uma vez; `option-select.tsx` é um `Select` sem digitação. O kit já tem `src/components/ui/command.tsx` (cmdk) e `popover.tsx`.
- Não existe seed: as tabelas de referência só têm o que os testes ou o operador inseriram em `data/*.db`.

## Goals / Non-Goals

**Goals:**
- Gravar gestor, suplente e fiscal pelo CPF, como o legado, e deixar a junção com `pessoas_fisicas` por `cpf`.
- Permitir achar pessoa e fornecedor digitando nome, CPF ou CNPJ, em tabelas de qualquer tamanho.
- Dar à 019 e à 025 um contrato de dados estável (colunas, formato, chaves, helpers).
- Converter o que já está gravado no SQLite sem perder informação.

**Non-Goals:**
- Escrever o loader do dump (025) ou os relatórios (019).
- Criar telas de manutenção de pessoas ou fornecedores.
- Mudar a regra `RK-37f294a3dc8e` (fornecedor obrigatório) ou a mensagem dela.

## Decisions

### D1. Formato canônico: só dígitos, máscara só na tela

CPF é gravado com 11 dígitos e CNPJ com 14, sem pontuação, em toda coluna (`pessoas_fisicas.cpf`, `prestadores_servicos.cnpj`, `contratos.pessoaFisicaId`, `contratos.suplenteId`, `fiscais.pessoaFisicaCpf`). Motivo: é o formato do legado (maxLength 11 e 14 nas telas) e é o que a 025 copia sem transformação; com máscara gravada, a junção `cpf = pessoaFisicaId` dependeria de todos os lados formatarem igual. A API aceita o valor com ou sem máscara e normaliza com `onlyDigits()` antes de validar. Exibição: `formatCpf()` → `###.###.###-##`, `formatCnpj()` → `##.###.###/####-##` (`src/lib/format.ts`, usando `applyMask` e `MASKS.cpf`/novo `MASKS.cnpj` de `src/lib/mask.ts`). Isso muda o formato gravado em `fiscais` (hoje mascarado): a migração converte (D7).

### D2. Modelo de dados

| Tabela | Coluna | Tipo Prisma | Restrição | Origem |
|---|---|---|---|---|
| `pessoas_fisicas` | `cpf` | `String?` | `@unique`, 11 dígitos | `global.pessoas_fisicas.CPF` (025) |
| `prestadores_servicos` | `cnpj` | `String?` | `@unique`, 14 dígitos | `global.prestadores_servicos.CNPJ` (025) |
| `contratos` | `pessoaFisicaId` | `String?` (sem mudança de tipo) | 11 dígitos; sem FK | CPF do gestor |
| `contratos` | `suplenteId` | `String?` (sem mudança de tipo) | 11 dígitos; sem FK | CPF do suplente |
| `contratos` | `prestadorServicoId` | `Int?` (sem mudança) | FK `prestadores_servicos.id` (já existe) | id local do fornecedor |
| `fiscais` | `pessoaFisicaCpf` | `String` (sem mudança de tipo) | 11 dígitos; sem FK | CPF do fiscal |
| `migracao_pendencias` (nova) | `id Int @id @default(autoincrement())`, `origem String`, `tabela String`, `registroId Int`, `campo String`, `valorAntigo String?`, `motivo String`, `criadoEm DateTime @default(now())`, `resolvidoEm DateTime?` | — | `@@index([origem, resolvidoEm])` | migração 022 (D7); a 025 pode reaproveitar |

`cpf`/`cnpj` são opcionais porque o banco `global` pode ter linhas sem documento; `@unique` porque o legado junta por eles (uma chave que se repete tornaria o gestor ambíguo). SQLite aceita vários `NULL` num índice único. Os nomes `pessoaFisicaId`/`suplenteId` são mantidos (são os nomes do legado e já estão em spec, testes e API).

**CPF sem FK.** `contratos.pessoaFisicaId`/`suplenteId` e `fiscais.pessoaFisicaCpf` não ganham FK para `pessoas_fisicas.cpf`: no legado a referência atravessa bancos (`global`), sem FK, e a carga do dump não pode recusar um contrato porque o gestor saiu do `global`. A existência é conferida **na gravação pela aplicação** (D5) e os órfãos aparecem como "CPF não encontrado" (D6).

### D3. Fornecedor: FK por `id` + CNPJ exibido e buscável (e não chave por CNPJ)

Opções avaliadas para `contratos.prestadorServicoId`:

| | (a) FK por `id`, CNPJ como coluna única do fornecedor | (b) chave por CNPJ (`prestadorServicoCnpj String`) |
|---|---|---|
| Código e testes atuais | sem mudança de tipo; `RK-37f294a3dc8e` continua `requiredInt` (`contratos.server.ts:72`); cópia no aditivo igual | troca tipo, schema, filtro, aditivo, include e testes |
| Relatórios 019 | `include: { prestadorServico }` traz razão social e CNPJ; `orderBy: { prestadorServico: { deRazaoSocial } }` funciona ("ordem por contratada", `docs/legado/relatorios.md`) | sem relação Prisma: razão social por segunda consulta; ordenar por contratada exige SQL cru |
| Carga 025 | traduz CNPJ → `id` com um mapa carregado de `prestadores_servicos`; CNPJ sem fornecedor é erro de checagem | copia direto |
| Recarga do `global` | upsert por `cnpj` preserva o `id` local | estável por natureza |

**Decisão: (a).** O custo de (a) concentra-se num passo da 025 (tradução CNPJ → id, por upsert por `cnpj`), enquanto (b) espalha mudanças por cadastro, aditivo, filtros, relatórios e prestação de contas. A compatibilidade com o legado vem de `cnpj` único: a busca aceita CNPJ, o rótulo mostra "Razão social — CNPJ" e a 025 mantém o `id` estável ao recarregar (upsert por `cnpj`, nunca apagar e recriar). Gestor e suplente ficam com CPF porque a coluna já é `String`, a spec arquivada já manda gravar o CPF e não há relação Prisma a preservar.

### D4. APIs de referência (`GET /api/pessoas_fisicas`, `GET /api/prestadores_servicos`)

Continuam só `GET`, com sessão (`referenceListHandler`). Parâmetros:

| Parâmetro | `pessoas_fisicas` | `prestadores_servicos` |
|---|---|---|
| `q` | `deNome contains q` **ou**, se `onlyDigits(q)` tem 3+ dígitos, `cpf startsWith dígitos` | `deRazaoSocial contains q` **ou**, se 3+ dígitos, `cnpj startsWith dígitos` |
| chave exata | `cpf=<11 dígitos, com ou sem máscara>` | `id=<int>` ou `cnpj=<14 dígitos>` |
| `comCpf=1` | só linhas com `cpf` não nulo | — |
| `page`, `size` | como hoje (`size` máx. 100) | como hoje |
| ordem | `deNome asc, id asc` | `deRazaoSocial asc, id asc` |
| colunas devolvidas | `id`, `idPessoaFisica`, `cpf`, `deNome` | `id`, `cnpj`, `deRazaoSocial` |

Implementação: `src/lib/reference/tables.ts` ganha, por tabela, `select`, `orderBy`, `documentField` (`cpf`/`cnpj`) e `exactFields` (lista branca: `cpf`; `id`, `cnpj`); `searchWhere` passa a montar `OR` com nome e documento; `listReference` recebe os `URLSearchParams`. Parâmetro fora da lista branca é ignorado. Tudo via Prisma (valor parametrizado). As demais tabelas de referência mantêm o comportamento atual. A projeção enxuta de `pessoas_fisicas` evita expor endereço, filiação e nascimento agora que a API passa a responder busca por CPF.

### D5. Gravação de gestor, suplente, fiscal e fornecedor

- `contratos.server.ts`: `pessoaFisicaId` e `suplenteId` usam `optionalCpf("Gestor")`/`optionalCpf("Gestor suplente")` (novo em `src/lib/rules/fields.ts`): vazio → `null`; senão `onlyDigits`; diferente de 11 dígitos → `"<rótulo>: CPF deve ter 11 dígitos"`. No `beforeSave`, se o valor mudou em relação a `current` (ou é criação), confere `prisma.pessoaFisica.findUnique({ where: { cpf } })`; ausente → `FieldRuleError({ pessoaFisicaId: "Gestor não encontrado em pessoas físicas" })` (idem `suplenteId`: "Gestor suplente não encontrado em pessoas físicas"). Valor inalterado de um contrato carregado do legado com CPF órfão **não** é reconferido (a edição de outro campo não pode ser bloqueada por um dado do `global`).
- `prestadorServicoId`: continua `requiredInt("Informe o fornecedor")` (`RK-37f294a3dc8e`); o `beforeSave` confere que o `id` existe (`"Fornecedor não encontrado"`) em vez de deixar a FK estourar como erro 500.
- `fiscais.server.ts`: `pessoaFisicaCpf` = `requiredString(MSG.obrigatorio("Pessoa Física CPF"))` → `onlyDigits` → 11 dígitos (mensagem `MSG_CPF_INCOMPLETO`, mantida) → existência em `pessoas_fisicas` no `beforeSave` quando muda (`"Pessoa física não encontrada para o CPF informado"`).
- Mensagens novas não vêm do legado (não há RK para elas); as do legado (`RK-37f294a3dc8e`, `RK-0f7caf172fab`, `RK-6b60cd49b7ed`) não mudam.

### D6. Componente de busca remota (`src/components/crud/remote-lookup.tsx`)

- Novo `FieldKind` `"search"` e `ListFilter.kind` `"search"` em `src/components/crud/types.ts`; `lookup` ganha `detailField?: string` e `detailFormat?: "cpf" | "cnpj"` (config declarativa, sem função, porque as configs de `src/lib/entities/*.ts` são passadas de server components para client components).
- UI: `Popover` + `Command` do shadcn/ui (`src/components/ui/popover.tsx`, `command.tsx`), `Command shouldFilter={false}` (o filtro é da API). Gatilho mostra o rótulo do valor atual; `CommandInput` com placeholder "Busca (CPF ou Nome)" (texto do legado) ou "Busca (CNPJ ou Razão social)".
- Hook `useRemoteOptions(lookup, query)` em `use-options.ts`: espera 300 ms sem digitação, cancela a requisição anterior (`AbortController`), chama `GET <api>?q=<texto>&size=20`; ao abrir sem texto, traz a primeira página (20, em ordem alfabética). Rótulo da opção: `<labelField> — <detailField formatado>`; sem documento → `<labelField> — sem CPF/CNPJ`.
- Rodapé: "Mostrando 20 de N — continue digitando para refinar" quando `total > 20`; "Nenhum resultado" quando vazio; "Erro ao buscar" com resposta não-OK.
- Valor já gravado (edição e filtro vindo da URL): o componente resolve o rótulo com `GET <api>?<valueField>=<valor>&size=1`; se não achar, mostra o valor formatado seguido de "(não encontrado)" e mantém o valor.
- Acessibilidade: o gatilho recebe `id`, `aria-invalid`, `aria-describedby`, `aria-required` como o `OptionSelect`; campo não obrigatório tem a ação "Limpar".
- `entity-form.tsx` e `entity-list.tsx` renderizam `RemoteLookup` para `kind: "search"`; `useLookupOptions` e `OptionSelect` continuam para tabelas pequenas (tipo, modalidade, departamento, situação).

| Tela | Campo | `api` | `labelField` | `valueField` | `detailField`/`detailFormat` |
|---|---|---|---|---|---|
| Contratos (form e filtro `gestor`) | `pessoaFisicaId`, `suplenteId`, `gestor` | `/api/pessoas_fisicas?comCpf=1` | `deNome` | `cpf` | `cpf` / `cpf` |
| Contratos (form e filtro) | `prestadorServicoId` | `/api/prestadores_servicos` | `deRazaoSocial` | `id` | `cnpj` / `cnpj` |
| Fiscais (form) | `pessoaFisicaCpf` | `/api/pessoas_fisicas?comCpf=1` | `deNome` | `cpf` | `cpf` / `cpf` |

### D7. Migração `022_pessoas_fornecedores` e dados já gravados

Gerada com `npx prisma migrate dev --create-only --name 022_pessoas_fornecedores` e completada à mão com o SQL de dados, na mesma migração (transação única do `migrate deploy`):

1. `ALTER TABLE` / índices únicos de `pessoas_fisicas.cpf` e `prestadores_servicos.cnpj`; `CREATE TABLE migracao_pendencias`.
2. `fiscais`: `UPDATE fiscais SET pessoaFisicaCpf = replace(replace(pessoaFisicaCpf, '.', ''), '-', '')` (o formato antigo é sempre `###.###.###-##`, garantido por `maskedString`).
3. `contratos.pessoaFisicaId` e `suplenteId` hoje guardam `idPessoaFisica` em texto. No momento da migração `pessoas_fisicas.cpf` acabou de nascer vazio, então **não dá para converter em SQL**. Para cada valor não nulo que não é um CPF (`length <> 11 OR` contém não-dígito, ou é de 11 dígitos mas não existe como `cpf`): grava em `migracao_pendencias` (`origem='022'`, `tabela='contratos'`, `registroId`, `campo`, `valorAntigo`, `motivo='idPessoaFisica aguardando CPF'`) e zera o campo. Nada se perde: o `idPessoaFisica` fica guardado.
4. `scripts/resolver-cpf-gestores.mjs` (idempotente; `--dry-run` só lista): para cada pendência aberta de `origem='022'`, procura `pessoas_fisicas` com `idPessoaFisica = valorAntigo` e `cpf` não nulo; achou e o campo do contrato ainda está nulo → grava o CPF e marca `resolvidoEm`; não achou → mantém aberta. Também lista (sem alterar) `fiscais.pessoaFisicaCpf` que não existe em `pessoas_fisicas`. Imprime contagem de resolvidas, abertas e fiscais órfãos. Roda depois de preencher `pessoas_fisicas.cpf` — pela 025 em homologação/produção ou pelo seed em desenvolvimento.

### D8. Como os dados de referência entram (continuam somente leitura)

- **Produção/homologação — 025.** O loader da 025 grava `global.pessoas_fisicas` (com `CPF` → `cpf`) e `global.prestadores_servicos` (com `CNPJ` → `cnpj`) **antes** de `contratos` e `fiscais`, por upsert pela chave (`cpf`, `cnpj`), nunca apagando e recriando (preserva `prestadores_servicos.id`, D3). Contrato de dados que a 025 cumpre: documento só com dígitos, completado com zeros à esquerda até 11/14; `contratos.pessoa_fisica_id`/`suplente_id` copiados como CPF; `prestador_servico_id` (CNPJ) traduzido para `prestadores_servicos.id` — CNPJ sem fornecedor é erro listado no relatório de checagens; `fiscais.pessoa_fisica_CPF` copiado como CPF; CPF/CNPJ com DV inválido ou repetido no `global` vira aviso no relatório (D9); ao final roda `scripts/resolver-cpf-gestores.mjs`.
- **Desenvolvimento/demo — seed.** `scripts/seed-referencia.mjs` (`npm run seed:referencia`): cria 30 pessoas físicas e 10 fornecedores fictícios com CPF/CNPJ de DV válido (upsert pela chave) e, com `--preencher-existentes`, atribui CPF fictício válido às pessoas já existentes sem `cpf`. Recusa rodar com `NODE_ENV=production`. Não é chamado pelo `docker/entrypoint.sh`.
- Nenhuma rota `POST/PUT/DELETE` nem tela de manutenção é criada para essas tabelas.

### D9. Dígito verificador: implementado, mas não bloqueia referência existente

`src/lib/documento.ts` exporta `onlyDigits`, `isCpfValido` (11 dígitos, rejeita sequências repetidas como `11111111111`, dois DV módulo 11) e `isCnpjValido` (14 dígitos, pesos 5..2/9..2 e 6..2/9..2).

**Decisão:** o DV **não** é condição para gravar gestor, suplente, fiscal ou fornecedor. Justificativa: (1) o valor gravado sempre vem de uma linha que existe em `pessoas_fisicas`/`prestadores_servicos` (conferido em D5) — existir na referência é uma garantia mais forte que o DV; (2) essas tabelas vêm do banco `global`, mantido por outros sistemas do DETRAN-RJ; se houver documento com DV inválido lá, recusar aqui impediria cadastrar o contrato real sem que o operador possa corrigir nada (a referência é somente leitura); (3) o legado não tem regra de DV rastreada (nenhuma RK em `docs/legado/rk-conferencia.md`). Onde o DV é usado: checagem de qualidade (aviso, não recusa) no relatório da carga 025, geração do seed e testes. A busca por documento aceita prefixo e não confere DV.

### D10. Exibição

- `/contratos/[id]`: Gestor e Gestor suplente como "Nome — 123.456.789-09" (via `pessoasPorCpf`); CPF sem pessoa → "123.456.789-09 (não encontrado em pessoas físicas)"; Fornecedor como "Razão social — 12.345.678/0001-90" (`contratoInclude.prestadorServico` passa a selecionar `cnpj`).
- `/fiscais`: coluna "Fiscal" (nome via `pessoasPorCpf`, montada em `listFiscais`) e coluna "CPF" formatada (novo `ColumnFormat` `"cpf"` em `format-cell.tsx`).
- Helper `src/lib/reference/pessoas.ts`: `pessoasPorCpf(cpfs: (string | null)[]): Promise<Map<string, { cpf: string; deNome: string | null }>>` — uma consulta `cpf in (...)`; usado aqui e disponível para a 019.

### D11. Filtros da lista de Contratos

`gestor` (CPF; aceita com máscara, normaliza para dígitos; compara igualdade com `pessoaFisicaId` ou `suplenteId`) e `prestadorServicoId` (id) passam a usar `kind: "search"`. A semântica dos parâmetros de `GET /api/contratos` não muda, só o valor de `gestor` (CPF em vez de `idPessoaFisica`).

## Risks / Trade-offs

- [CPF duplicado no `global` quebra o índice único na carga] → a 025 detecta duplicatas antes de gravar e reporta; Open Question abaixo.
- [Gestores de contratos criados no app antes da 025 ficam vazios até o resolvedor rodar] → ficam em `migracao_pendencias` com o `idPessoaFisica`; o resolvedor é idempotente e a contagem de pendências abertas aparece na saída.
- [IDs de fornecedor mudam numa recarga] → a 025 faz upsert por `cnpj` e nunca recria linhas; teste da 025 cobre recarga.
- [Busca por nome com `contains` faz varredura em SQLite] → aceitável para dezenas de milhares de linhas; `size` máx. 20 no componente e debounce de 300 ms.
- [Duas changes (019 e 022) modificando `app-shell`] → requirements diferentes; quem arquivar depois confere que o texto copiado em MODIFIED é o da spec já atualizada.

## Open Questions

- **Zeros à esquerda** — o `global` guarda CPF/CNPJ como texto ou número? Se número, CPFs que começam com 0 perderam dígitos; a 025 completa com zeros (D8). Confirmar no dump.
- **Duplicidade** — o `global.pessoas_fisicas` pode ter o mesmo CPF em mais de uma linha (ex.: readmissão)? Se sim, qual linha vale (mais recente, `dtExcluido` nulo)? Decisão provisória: a 025 escolhe a linha com `dtExcluido` nulo e maior `id`, e reporta as demais.
- **Ordem de aplicação** — `019` e `020` são numeradas antes desta e dependem dela; o `config.yaml` manda aplicar em ordem numérica. O autor precisa confirmar a ordem 022 → 020 → 019 (como a `019-relatorios/proposal.md` já indica) ou renumerar.
- **Pessoa excluída** — o fiscal/gestor deve poder ser escolhido se `pessoas_fisicas.dtExcluido` estiver preenchido? Hoje a busca não filtra por `dtExcluido`; confirmar no legado (`getSourceFile` do controller de contratos).
- **`pessoas.cpf`/`pessoas.cnpj`** — a tabela `pessoas` tem documentos mas nenhuma ligação rastreada com `pessoas_fisicas` ou `prestadores_servicos`; não é usada aqui.
