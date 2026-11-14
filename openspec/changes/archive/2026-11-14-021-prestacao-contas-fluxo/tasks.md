# Tasks

Nenhuma regra desta change tem chave `RK-…` conhecida (`docs/legado/rk-conferencia.md`); os pontos
de regra levam comentário `// Legado: docs/legado/prestacao-contas.md — <regra>` e, se o MCP da RNC
devolver uma chave (`findRules`/`getRule`), `// RK-…` no mesmo ponto.

## 1. Modelo de dados

- [x] 1.1 _(Já entregue antes do apply: migração `20261114022518_021_prestacao_contas_fluxo`; `prisma migrate status` no banco de desenvolvimento limpo.)_ Em `prisma/schema.prisma`, adicionar `prestacaoContas String @default("N")` ao model `TipoContrato` e criar a migração `021_prestacao_contas_fluxo` (`npx prisma migrate dev --name 021_prestacao_contas_fluxo`). Verificação: a migração aplica sem erro em banco vazio e num banco com tipos existentes (todos ficam "N"); `npx prisma migrate status` limpo.

## 2. Tipos de contrato

- [x] 2.1 `src/lib/entities/tipo_contratos.server.ts`: campo opcional `prestacaoContas` (`z.enum(["S","N"])`, vazio/ausente → não enviado, default do banco) no schema estrito; `listWhere` passa a aceitar `?prestacaoContas=S|N` além de `gerenciamento`. Verificação: testes em `tests/tipo_contratos.test.ts` para os cenários *Tipo novo nasce desmarcado*, *Valor inválido* e *Filtrar tipos marcados*.
- [x] 2.2 `src/lib/entities/tipo_contratos.ts`: `FieldDef` `{ name: "prestacaoContas", label: "Sujeito à prestação de contas", kind: "toggle", toggleValues: ["S","N"] }` depois dos campos existentes (juntar ao que a 019 tiver deixado no arquivo). Verificação: teste do cenário *Marcar um tipo* (PUT liga a flag) e checagem manual do toggle em `/tipo_contratos/[id]/edit`.

## 3. Critérios e cálculos

- [x] 3.1 Criar `src/lib/prestacao/criterios.ts` com `PRESTACAO_VALOR_MINIMO = new Prisma.Decimal("650000.00")`, `hojeUtc(now)`, `prestacaoWhere(params, now)` (tipo marcado, `parentId: null`, `dataTermino < hoje`, `valorTotal > limite`, situação, `tipoContratoId`, `modalidadeId`, busca por `campo`/`q`) e comentário de legado em cada critério. Verificação: testes unitários em `tests/prestacao_criterios.test.ts` dos cenários *Contrato que atende a todos os critérios*, *Limite de valor é estrito*, *Tipo não marcado, aditivo ou contrato vigente ficam de fora* e *Aditivo não prorroga o vencimento*, mais "nenhum tipo marcado → lista vazia".
- [x] 3.2 Em `criterios.ts`, `diasDesdeVencimento(dataTermino, now)` e `mesesDesdeInicio(dataInicio, now)` (fórmula de `PERIOD_DIFF`, `null` sem data). Verificação: teste do cenário *Dias e meses do painel* com `now` fixo em 13/11/2026 (10 dias, 21 meses) e caso de virada de ano.
- [x] 3.3 Em `criterios.ts`, `gestorKeysPorNome(q)` (ids de `pessoas_fisicas` por `deNome contains`, como texto, mesma chave de `getContratoDetalhe` em `src/lib/entities/contratos.server.ts`) e `ordenarPorGestor(...)`. Verificação: testes dos cenários *Buscar pelo gestor* e *Ordenar por gestor*.

## 4. API

- [x] 4.1 `src/app/api/prestacao_contas/contratos/route.ts` (`GET`) com `requireUser`, `parsePagination`, `prestacaoWhere`, ordenação de `design.md` (`ordenar`, `dir`, aceitando `valor:desc`), `include` de departamento, prestador, tipo e modalidade, e `diasDesdeVencimento` em cada item; `campo` inválido → `400 { errors: { campo } }`. Verificação: testes dos cenários *Alternar entre pendentes e realizadas*, *Colunas, dias e paginação* (`size=10`), *Buscar pela contratada*, *Coluna de busca inválida*, *Ordenar por valor decrescente*, *Filtrar por modalidade* e `401` sem sessão.
- [x] 4.2 `src/app/api/prestacao_contas/contratos/[id]/route.ts` (`GET`) devolvendo o painel, `prazos`, `periodo`, `fases` com `ultimo` e `historico` (usuário só `{ id, username }`), `404` para contrato inexistente. Verificação: testes dos cenários *Contrato inexistente*, *Escolher o prazo*, *Última descrição por fase* e checagem de que nenhum campo `password*` aparece na resposta.
- [x] 4.3 `src/lib/entities/prestacao_contas.server.ts`: delegate próprio cujo `create` roda `prisma.$transaction` (insere a linha e chama `concluiSeFaseFinal(tx, fase, atendido, contratoId)` de `criterios.ts`, que grava `prestacaoRealizada = "1"` quando `fase.periodo.trim() === "30"` e `atendido === "S"`), mantendo `prepare` (descarta `userId`/`dataInclusao`) e `beforeSave` (existência, `dataInclusao`, `withAuthor`). Comentário `// Legado: docs/legado/prestacao-contas.md — periodo == 30 && atendido == 1 → prestacao_realizada = 1` no `if`. Verificação: testes dos cenários *Gravar fase com autoria da sessão*, *Campo desconhecido*, *Fase inexistente*, *Fase de período 30 atendida conclui*, *Fase de período 30 não atendida não conclui*, *Outro período atendido não conclui* e *Conclusão não é desfeita*.
- [x] 4.4 `listWhere` de `prestacaoContasApi` com `?contratoId=` e ordem `id desc`; em `src/app/api/prestacao_contas/[id]/route.ts` exportar só `GET` (remover `PUT` e `DELETE`). Verificação: testes dos cenários *Histórico do contrato* e *Registro gravado não é editado nem excluído* (`405` e registro inalterado no banco).

## 5. Telas

- [x] 5.1 _(Entregue pela 024: `pageSize` e `extraParams`; a volta à página 1 ao trocar de aba é feita na página com `key={situacao}`, ver design.md › Open Questions.)_ `src/components/crud/entity-list.tsx`: props opcionais `pageSize` (padrão 20) e `extraParams` (somados à query e às dependências do `load`, voltando à página 1 quando mudam). Verificação: `npm test` verde nas listas existentes (sem mudança de comportamento) e teste do novo parâmetro na lista de prestação.
- [x] 5.2 _(`tabs` já instalado.)_ Adicionar o componente `tabs` do shadcn/ui (`npx shadcn@latest add tabs`) e reescrever `src/app/(app)/prestacao_contas/page.tsx`: `Tabs` Pendentes/Realizadas (`?situacao=`), `EntityList` com `api="/api/prestacao_contas/contratos"`, `pageSize={10}`, `canCreate={false}`, `rowHref="/prestacao_contas/{id}"`, filtros `campo`, `ordenar`, `tipoContratoId` (lookup `/api/tipo_contratos?prestacaoContas=S`) e `modalidadeId`; configuração em `src/lib/entities/prestacao_contas.ts` (colunas de `design.md` › Lista). Verificação: teste da configuração de colunas/filtros e checagem manual alternando abas, buscando, ordenando e paginando (10 por página).
- [x] 5.3 Criar `src/app/(app)/prestacao_contas/[contratoId]/page.tsx` e o componente cliente `src/components/prestacao/fluxo.tsx`: `Card` do painel, `Select` do prazo (`?periodo=`), `Table` de fases com `Textarea`, `Switch` e `Button` "Gravar" (POST, toast `sonner`, erro `400` inline, recarrega painel e histórico), `Table` do histórico. Verificação: checagem manual gravando a fase de período 30 atendida e vendo o selo mudar para Realizada e o contrato ir para a aba Realizadas.
- [x] 5.4 Remover `src/app/(app)/prestacao_contas/new/` e `src/app/(app)/prestacao_contas/[id]/edit/`; breadcrumb "Prestação de contas › Pendentes/Realizadas" e "› Contrato <número>" em `src/components/shell/app-breadcrumb.tsx` (ou onde o rótulo for resolvido). Verificação: `npm run build` sem rotas órfãs; checagem manual de que `/prestacao_contas/new` dá 404 e o item de menu "Prestação de contas" abre a lista nova.

## 6. Verificação

- [x] 6.1 Reescrever `tests/prestacao_contas.test.ts` (os testes dos requisitos removidos saem) com um teste por `#### Scenario:` de `specs/prestacao-contas/spec.md` e de `specs/tipo-contratos/spec.md`; `npm test` verde, inclusive `tests/rk-coverage.test.ts` e `tests/security.test.ts`.
- [x] 6.2 `npm run lint` e `npm run build` sem erro. _(Apply 14/11/2026: `npx eslint` nos arquivos da 021 e `npx tsc --noEmit` sem erro; `npm run lint` acusa 4 erros só em `tests/migracao-022.test.ts` (fora desta change); `next build` não foi rodado por ordem do coordenador.)_
- [x] 6.3 `openspec validate 021-prestacao-contas-fluxo --strict` passa; com o MCP da RNC conectado, `findRules` em `prestacao_contas_controller.php`/`prestacao_conta.php` para descobrir se há `RK-…` das regras desta change e registrar o resultado em `design.md` › Open Questions.
