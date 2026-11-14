# Tasks

## 1. Documentos (CPF/CNPJ)

- [x] 1.1 Criar `src/lib/documento.ts` com `onlyDigits`, `isCpfValido` e `isCnpjValido` (design.md D9). Verificação: `tests/documento.test.ts` com o cenário *Conferir DV* (`52998224725` válido, `52998224724` e `11111111111` inválidos, `11222333000181` válido, `11222333000180` inválido); `npm test -- documento`.
- [x] 1.2 Acrescentar `MASKS.cnpj = "##.###.###/####-##"` em `src/lib/mask.ts` e `formatCpf`/`formatCnpj` em `src/lib/format.ts` (aceitam valor com ou sem máscara; vazio → `""`). Verificação: casos novos em `tests/mask.test.ts` e `tests/format.test.ts` (cenário *Exibir documentos*).
- [x] 1.3 Acrescentar `optionalCpf(label)` e `requiredCpf(message, incompleteMessage)` em `src/lib/rules/fields.ts` (normalizam com `onlyDigits`, exigem 11 dígitos, não conferem DV — D9). Verificação: testes unitários em `tests/rules.test.ts` (máscara aceita, 10 dígitos recusado, DV inválido aceito).

## 2. Modelo de dados e migração

- [x] 2.1 `prisma/schema.prisma`: `PessoaFisica.cpf String? @unique`, `PrestadorServico.cnpj String? @unique` e o modelo `MigracaoPendencia` (`@@map("migracao_pendencias")`, colunas de design.md D2). Verificação: `npx prisma validate` sem erro.
- [x] 2.2 Gerar `npx prisma migrate dev --create-only --name 022_pessoas_fornecedores` e completar o `migration.sql` com o SQL de dados de design.md D7 (passos 2 e 3: `fiscais` sem máscara; gestores/suplentes não-CPF para `migracao_pendencias` e campo nulo). Verificação: `tests/migracao-022.test.ts` aplica as migrações até a 017 num banco temporário, insere um contrato com `pessoaFisicaId` `"1001"` e um fiscal `529.982.247-25`, aplica a 022 e confere os cenários *Migrar gestor gravado como idPessoaFisica* e *Migrar fiscal mascarado*; `npx prisma migrate deploy` numa cópia de `data/demo.db` sem erro.
- [x] 2.3 Conferir que `CPF repetido` é recusado. Verificação: teste em `tests/referencia.test.ts` que cria duas pessoas com `cpf` `52998224725` e espera o erro `P2002` do Prisma.

## 3. APIs de referência

- [x] 3.1 `src/lib/reference/tables.ts`: por tabela, `select` (projeção de D4), `orderBy` por nome/razão social, `documentField` e `exactFields`; `searchWhere` com `OR` nome `contains` / documento `startsWith` dígitos (3+ dígitos); `comCpf=1` em `pessoas_fisicas`; parâmetros fora da lista branca ignorados. `src/lib/reference/route.ts` repassa os `URLSearchParams`. Verificação: `tests/referencia.test.ts` com os cenários *Buscar pessoa por nome*, *Buscar pessoa por CPF mascarado*, *Buscar fornecedor por CNPJ*, *Resolver o valor gravado*, *Só pessoas com CPF, em ordem alfabética*, *Sem sessão* e *Projeção enxuta de pessoas físicas*.
- [x] 3.2 Confirmar que `/api/pessoas_fisicas` e `/api/prestadores_servicos` só exportam `GET`. Verificação: teste do cenário *Nenhuma escrita em pessoas físicas e fornecedores* (`POST`/`PUT`/`DELETE` com sessão → `405`).
- [x] 3.3 Criar `src/lib/reference/pessoas.ts` com `pessoasPorCpf(cpfs)` (uma consulta `cpf in`, ignora nulos e repetidos; D10). Verificação: teste unitário em `tests/referencia.test.ts` (dois CPFs, um órfão → mapa com um item).

## 4. Componente de busca remota

- [x] 4.1 `src/components/crud/types.ts`: `FieldKind` `"search"`, `ListFilter.kind` `"search"`, `lookup.detailField` e `lookup.detailFormat` (`"cpf" | "cnpj"`); `ColumnFormat` `"cpf" | "cnpj"` e formatação em `format-cell.tsx`. Verificação: `npx tsc --noEmit` sem erro.
- [x] 4.2 `src/components/crud/use-options.ts`: hook `useRemoteOptions(lookup, query)` (debounce 300 ms, `AbortController`, `size=20`, devolve `options` e `total`) e `useResolvedOption(lookup, value)` (`GET <api>?<valueField>=<valor>&size=1`). Verificação: teste com `vi.useFakeTimers()` e `fetch` simulado — digitar "Maria Ges" em sequência gera uma só chamada a `/api/pessoas_fisicas?comCpf=1&q=Maria%20Ges&size=20` (cenário *Digitar parte do nome*).
- [x] 4.3 Criar `src/components/crud/remote-lookup.tsx` com `Popover` + `Command` do shadcn/ui (`shouldFilter={false}`), rótulo "<nome> — <documento formatado>", placeholder "Busca (CPF ou Nome)" / "Busca (CNPJ ou Razão social)", aviso "Mostrando 20 de N — continue digitando para refinar", "Nenhum resultado", "Erro ao buscar", ação "Limpar" em campo não obrigatório e atributos `aria-*` iguais aos do `OptionSelect`. Verificação: checagem manual em `/contratos/new` com o seed (7.1) carregado — cenários *Digitar parte do nome* e *Mais resultados do que cabem*.
- [x] 4.4 `entity-form.tsx` e `entity-list.tsx` renderizam `RemoteLookup` para `kind: "search"`, mantendo `OptionSelect` para `lookup`/`select`. Verificação: checagem manual do cenário *Abrir uma edição* em `/contratos/[id]/edit` com gestor preenchido; `npm run lint` sem erro.

## 5. Contratos

- [x] 5.1 `src/lib/entities/contratos.ts`: `pessoaFisicaId`, `suplenteId` e o filtro `gestor` com `kind: "search"` e lookup `{ api: "/api/pessoas_fisicas?comCpf=1", labelField: "deNome", valueField: "cpf", detailField: "cpf", detailFormat: "cpf" }`; `prestadorServicoId` (campo e filtro) com `kind: "search"` e `{ api: "/api/prestadores_servicos", labelField: "deRazaoSocial", valueField: "id", detailField: "cnpj", detailFormat: "cnpj" }`. Verificação: atualizar os testes *Buscar o gestor* e *Escolher o fornecedor* de `tests/contratos.test.ts` para a nova config.
- [x] 5.2 `src/lib/entities/contratos.server.ts`: `pessoaFisicaId`/`suplenteId` com `optionalCpf`; no `beforeSave`, conferência de existência do CPF quando é criação ou o valor mudou em relação a `current`, com `FieldRuleError` e as mensagens de design.md D5. Verificação: testes dos cenários *Buscar o gestor pelo CPF*, *CPF com máscara pela API*, *CPF que não existe*, *CPF incompleto*, *Gestor do legado fora da referência* (requisito *CPF de gestor e suplente conferido pela API*) e *Pessoa do global com DV inválido* (app-shell; D9).
- [x] 5.3 Mesmo arquivo: manter `prestadorServicoId: requiredInt("Informe o fornecedor")` com o comentário `// RK-37f294a3dc8e` (linha 72) e acrescentar no `beforeSave` a conferência de existência ("Fornecedor não encontrado"). Verificação: testes *Fornecedor inexistente* e *Salvar sem fornecedor* (requisito *Fornecedor inexistente recusado*; o segundo já existe) (`RK-37f294a3dc8e`) continua verde; `tests/rk-coverage.test.ts` verde.
- [x] 5.4 `contratosWhere`: `gestor` normalizado com `onlyDigits` antes da igualdade. Verificação: testes *Filtrar pelo gestor* e *Filtro com CPF mascarado na URL*, trocando a fixture `"1001"` pelos CPFs `52998224725`/`11144477735`.
- [x] 5.5 `contratoInclude.prestadorServico` passa a selecionar `cnpj`; `getContratoDetalhe` usa `pessoasPorCpf` no lugar da busca por `idPessoaFisica`; `src/app/(app)/contratos/[id]/page.tsx` mostra "<nome> — <CPF>", "<razão social> — <CNPJ>" e "(não encontrado em pessoas físicas)" (D10). Verificação: testes de `getContratoDetalhe` para *Gestor encontrado* e *Gestor órfão*; checagem manual da página.
- [x] 5.6 Atualizar as fixtures de `tests/contratos.test.ts` (pessoas com `cpf`, fornecedores com `cnpj`, `pessoaFisicaId`/`suplenteId` em CPF). Verificação: `npm test -- contratos` todo verde.

## 6. Fiscais

- [x] 6.1 `src/lib/entities/fiscais.ts`: `pessoaFisicaCpf` com `kind: "search"` e o lookup de pessoas de 5.1; colunas "Fiscal" (`path: "pessoa.deNome"`) e "CPF" (`format: "cpf"`). Verificação: teste da config em `tests/fiscais.test.ts` e checagem manual do cenário *`pessoaFisicaCpf` é digitado* em `/fiscais/new` com o seed (7.1).
- [x] 6.2 `src/lib/entities/fiscais.server.ts`: `pessoaFisicaCpf` com `requiredCpf(MSG.obrigatorio("Pessoa Física CPF"), MSG_CPF_INCOMPLETO)` e conferência de existência no `beforeSave` quando cria ou muda ("Pessoa física não encontrada para o CPF informado"); `buscaWhere` com `onlyDigits(busca)` e `contains`; `listFiscais` acrescenta `pessoa: { deNome }` via `pessoasPorCpf`. Manter os comentários `// RK-0f7caf172fab` e `// RK-6b60cd49b7ed` em `fiscalFields`. Verificação: testes *CPF inexistente*, *CPF mascarado de pessoa existente*, *`busca` é digitado*, *Abrir a lista* (Lista de Fiscais com nome) e o teste existente de obrigatório de `pessoaFisicaCpf`; `npm test -- fiscais`.

## 7. Entrada dos dados de referência e conversão

- [x] 7.1 Criar `scripts/seed-referencia.mjs` e o script `seed:referencia` no `package.json`: 30 pessoas físicas e 10 fornecedores fictícios com DV válido (gerados no script com o mesmo algoritmo de `src/lib/documento.ts`; o teste confere cada documento com `isCpfValido`/`isCnpjValido`), upsert por `cpf`/`cnpj`, opção `--preencher-existentes`, erro e saída sem gravar com `NODE_ENV=production`. Verificação: teste *Seed recusado em produção* (executa o script com `NODE_ENV=production` num banco temporário e confere zero linhas); rodar duas vezes em `data/dev.db` não duplica linhas.
- [x] 7.2 Criar `scripts/resolver-cpf-gestores.mjs` (D7 passo 4): resolve pendências `origem='022'`, `--dry-run`, lista fiscais órfãos, imprime contagens. Verificação: `tests/migracao-022.test.ts` com os cenários *Resolver depois da carga*, *Pessoa ainda sem CPF*, *Simulação* e *Fiscal órfão listado*.
- [x] 7.3 Confirmar que `docker/entrypoint.sh` continua só com `prisma migrate deploy` (sem seed). Verificação: `grep -c seed docker/entrypoint.sh` imprime `0`.

## 8. Verificação

- [x] 8.1 Um teste por `#### Scenario:` de `specs/app-shell/spec.md`, `specs/contratos/spec.md` e `specs/fiscais/spec.md`; `npm test` todo verde, `npx tsc --noEmit` e `npm run lint` sem erro.
- [x] 8.2 `npm run smoke` passa com o banco migrado.
- [x] 8.3 `openspec validate 022-pessoas-fornecedores --strict` passa.
