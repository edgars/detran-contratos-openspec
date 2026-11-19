# Tasks

Pré-condição: `020-contratos-complementos`, `021-prestacao-contas-fluxo` e `022-pessoas-fornecedores` arquivadas (`ls openspec/changes/archive | grep -E '020|021|022'`). Se não estiverem, pare e registre em design.md › Open Questions.

## 1. Modelo de dados

- [ ] 1.1 Em `prisma/schema.prisma` › `TipoContrato`, acrescentar `contratoPrincipal String @default("N")` (`prestacaoContas` já veio da 021); gerar a migração `019_relatorios` (`npx prisma migrate dev --name 019_relatorios`). Verificação: o comando aplica sem erro e `migration.sql` só tem `ALTER TABLE "tipo_contrato" ADD COLUMN "contratoPrincipal" TEXT NOT NULL DEFAULT 'N'`.
- [ ] 1.2 Conferir o que 020, 021 e 022 entregaram (`PessoaFisica.cpf`, `PrestadorServico.cnpj`, `pessoasPorCpf` em `src/lib/reference/pessoas.ts`, `Contrato.projetoBasico` como nome de PDF, `Contrato.naPresidencia` 0/1, `TipoContrato.prestacaoContas`). Verificação: checagem manual de `schema.prisma` e do helper contra design.md › Context; divergência → registrar em Open Questions e parar.

## 2. Tipos de contrato (capability `tipo-contratos`)

- [ ] 2.1 `src/lib/entities/tipo_contratos.server.ts`: acrescentar ao schema `contratoPrincipal` e `indicativoMetaRisco` como `z.enum(["S","N"]).optional()` (ao lado do `prestacaoContas` da 021); remover o comentário "indicativoMetaRisco não está no formulário". Verificação: testes *Valor fora de S/N* e *Marcações ausentes* em `tests/tipo_contratos.test.ts`.
- [ ] 2.2 `src/lib/entities/tipo_contratos.ts`: campos toggle (`toggleValues: ["S","N"]`) "É o tipo Contrato (relatórios)" e "Entra no risco da meta", depois de `gerenciamento` e antes do toggle `prestacaoContas` da 021; colunas "Contrato" e "Risco da meta" (`format: "boolean"`). Verificação: testes *Abrir a lista*, *Salvar um registro válido* e *Marcar o tipo Contrato*.
- [ ] 2.3 Atualizar o teste "campo fora do schema (indicativoMetaRisco) gera 400" de `tests/tipo_contratos.test.ts` (linha 91 antes da 021): passa a esperar 201 com `"S"` e 400 com `"X"`. Verificação: `npm test -- tipo_contratos` verde.

## 3. Consultas (`src/lib/relatorios/`)

- [ ] 3.1 `comum.ts`: `hojeUtc()`, `diasAte()`, filtros `ORIGINAIS` (`parentId: null`), `TIPO_CONTRATO` (`contratoPrincipal: "S"`), `TIPO_RISCO` (`indicativoMetaRisco: "S"`); `somaDecimal()` com `Prisma.Decimal.plus`. Verificação: teste unitário de `diasAte` (vence hoje = 0) e de `somaDecimal` (`1000.10 + 2000.25 = 3000.35`, sem `Number`); `grep -rn "tipoContratoId: *[0-9]" src/lib/relatorios` sem resultado.
- [ ] 3.2 `chaves.ts`: `nomesDosGestores(cpfs)` sobre `pessoasPorCpf` (022) e `SELECT_CONTRATADA` (relação `prestadorServico`); único arquivo que conhece as chaves de 022. Verificação: teste resolvendo um CPF semeado para o nome.
- [ ] 3.3 `params.ts`: schemas zod `.strict()` dos parâmetros de cada relatório (`dias` 1–3650, datas `dd/MM/yyyy` via `parseDate`, `inicio`/`fim` juntos e em ordem, `gestor` 11 dígitos, `departamentoId` inteiro, `sort`/`dir`, `q`, `page`, `formato=csv`) com as mensagens de design.md. Verificação: testes *Sem número de dias* e *Período incompleto ou invertido*.
- [ ] 3.4 `contratos-por-gestor.ts`: agrupamento em memória por (gestor, tipo, unidade), grupo "Sem gestor", ordem gestor/tipo/unidade; `gestores()` com CPFs distintos de originais. Verificação: testes *Agrupar e somar*, *Contratos sem gestor*, *Filtrar por gestor e unidade* e *Só quem é gestor*.
- [ ] 3.5 `contratos-vencendo.ts`: `0 < dias < N`, período opcional inclusivo, ordenações de design.md. Verificação: testes *Vencendo em N dias*, *Vencendo dentro de um período* e *Aditivo não aparece*, *Ordenar por contratada*.
- [ ] 3.6 `contratos-vencidos.ts`: `inicio ≤ dataTermino ≤ fim`, ordem por vencimento. Verificação: testes *Vencidos no período* e *Prorrogação por aditivo não muda o vencimento*.
- [ ] 3.7 `cadastro-incompleto.ts`: tipo Contrato, `dataTermino > hoje`, `anexo` ou `projetoBasico` nulo/vazio, aviso `SEM_TIPO_CONTRATO`. Verificação: testes *Falta o projeto básico*, *Contrato vencido não entra* e *Tipo marcado entra no relatório*.
- [ ] 3.8 `acompanhamento-meta.ts`: listas Total, Vencidos (ordem contratada) e Em prorrogação/risco (`0 < dias ≤ 180`), resumo com soma `Decimal` e quantidade, `naPresidencia` como Sim/Não; deixar `// TODO(review): limites de dia e layout de meta.ctp (design.md › Open Questions)`. Verificação: testes *Três listas*, *Fora da janela de risco*, *Somar sem perder centavos* e *Nenhum tipo marcado*.
- [ ] 3.9 `acerto-valor.ts`: lista paginada (20, ordem `numeroContrato`, `q` em `objeto`) e `gravarValorInicial(id, texto)` com `parseCurrency` + `toDecimal` e `updateMany({ where: { id, parentId: null, valorInicial: null } })`, distinguindo 404/409. Verificação: testes *Só contratos sem valor inicial*, *Buscar por objeto*, *Gravar valor inicial*, *Valor inválido*, *Já informado ou aditivo* e *Campo extra*.
- [ ] 3.10 `csv.ts`: `toCsv()` com BOM, `;`, CRLF, aspas, valores `1234,56`, datas `dd/MM/yyyy` e prefixo `'` contra fórmula. Verificação: testes *Baixar CSV de vencidos* e *Fórmula neutralizada*.

## 4. API (`src/app/api/relatorios/`)

- [ ] 4.1 `GET` em `contratos-por-gestor/route.ts`, `contratos-por-gestor/gestores/route.ts`, `contratos-vencendo/route.ts`, `contratos-vencidos/route.ts`, `cadastro-incompleto/route.ts`, `acompanhamento-meta/route.ts`, `acerto-valor/route.ts`, todos com `requireUser()`, `dynamic = "force-dynamic"` e `400` por campo (`validationError`); `formato=csv` nos três primeiros relatórios devolve `text/csv` com `Content-Disposition`. Verificação: teste *Sem sessão* (401) e um teste de cada rota com sessão (`tests/helpers/auth.ts › loginAs`).
- [ ] 4.2 `PUT` em `acerto-valor/[id]/route.ts` com `readBody` e schema `{ valorInicial: z.string() }.strict()`. Verificação: testes da tarefa 3.9 pela rota.

## 5. Telas (`src/app/(app)/relatorios/` e `src/components/relatorios/`)

- [ ] 5.1 `relatorios/page.tsx`: índice com um `Card` por relatório e a dica de desmarcar "Cabeçalhos e rodapés" ao salvar PDF. Verificação: teste *Abrir o índice* (render do server component ou checagem dos seis `href`).
- [ ] 5.2 Componentes `report-header.tsx` (título de impressão, filtros, "Emitido em"), `report-actions.tsx` (*Imprimir / PDF* com `window.print()`, *Exportar CSV* como link para a API com os mesmos parâmetros), `report-table.tsx` (`Table` do shadcn, rodapé de totais) e `acerto-valor-linha.tsx` (input moeda + *Gravar*, toast). Verificação: teste de componente de *Abrir a impressão* (`window.print` chamado, com mock) e checagem manual em `npm run dev` de cada relatório.
- [ ] 5.3 Uma página por relatório (`contratos-por-gestor`, `contratos-vencendo`, `contratos-vencidos`, `cadastro-incompleto`, `acompanhamento-meta`, `acerto-valor`), com filtros `method="get"` e erro inline; vencendo e vencidos renderizam `<style>@page { size: A4 landscape; margin: 10mm }</style>`. Verificação: checagem manual dos cenários de cada requirement com dados semeados; *Imprimir vencendo* conferido em Chrome e Firefox (prévia de impressão em paisagem, sem menu nem filtros).
- [ ] 5.4 Folha de impressão: `@media print` em `src/app/globals.css` (esconde `[data-slot="sidebar"]`, remove fundos/sombras, `thead { display: table-header-group }`, `tr { break-inside: avoid }`, 9pt) e `print:hidden` no `<header>` de `src/app/(app)/layout.tsx`. Verificação: prévia de impressão de `/relatorios/contratos-por-gestor` mostra só título, filtros, data e tabela.

## 6. Navegação

- [ ] 6.1 `src/lib/navigation.ts`: item `{ name: "Relatorios", label: "Relatórios", href: "/relatorios", change: "019-relatorios", group: "contratos" }` e `"Relatorios"` depois de `"Contratos"` em `NAV_ORDER`; ícone `FileChartColumn` em `src/components/app-sidebar.tsx`. Verificação: `tests/navigation.test.ts` atualizado com "Relatorios" no fim de `SPEC_ENTITIES` e um teste de que o grupo `contratos` tem "Relatorios" logo depois de "Contratos" (cenário *Abrir o app*).
- [ ] 6.2 `src/components/shell/app-breadcrumb.tsx`: rótulos fixos dos seis slugs (ex.: `contratos-vencendo` → "Contratos vencendo", `acerto-valor` → "Acerto de valor"). Verificação: teste de `crumbsFor("/relatorios/contratos-vencendo")` = Relatórios › Contratos vencendo.

## 7. Verificação

- [ ] 7.1 Um teste por `#### Scenario:` de `specs/relatorios/spec.md`, `specs/tipo-contratos/spec.md` e `specs/app-shell/spec.md` em `tests/relatorios.test.ts`, `tests/tipo_contratos.test.ts` e `tests/navigation.test.ts`; `npm test` verde e `npm run lint` sem erro.
- [ ] 7.2 `grep -rn "parentId" src/lib/relatorios` mostra o filtro de originais em toda consulta e nenhuma consulta lê `aditivos` para vencimento (diretiva do autor). Verificação: o comando e revisão do diff.
- [ ] 7.3 Com o MCP da RNC conectado: `findRules` do módulo `relatorios` e `getSourceFile` de `meta.ctp`/`relatorios_controller.php` para fechar as Open Questions (limites de dia, layout da meta, ordenações, padrão de dias); citar como `// RK-…` qualquer regra encontrada. Verificação: Open Questions atualizadas em design.md.
- [ ] 7.4 `openspec validate 019-relatorios --strict` passa.
