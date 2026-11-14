# Tasks

## 1. Dados e utilitários

- [ ] 1.1 Migração só de dados `prisma/migrations/<timestamp>_020_contratos_complementos/migration.sql` com o `UPDATE` de `design.md` › Projeto básico em PDF (zera `projetoBasico` que não seja nome de `savePdf`). Verificação: `npx prisma migrate dev` aplica sem erro e `npx prisma migrate status` fica limpo; teste em `tests/contratos.test.ts` que grava `"texto livre"` e um nome válido via SQL, roda o `UPDATE` e confere `NULL` no primeiro e o nome mantido no segundo.
- [ ] 1.2 `removeStoredPdf(name)` em `src/lib/uploads.ts`: só apaga nomes do padrão `STORED_NAME`, ignora arquivo inexistente, nunca sai de `uploadDir()`. Verificação: teste unitário (nome válido apagado; `../x.pdf` e nome inexistente não lançam nem apagam nada).
- [ ] 1.3 `MSG.maximo(campo, n)` em `src/lib/rules/messages.ts`. Verificação: teste em `tests/rules.test.ts` com `MSG.maximo("Objeto", 200)` = "Objeto deve ter no máximo 200 caracteres".

## 2. Kit (props opcionais; coordenar com a 024)

- [ ] 2.1 `FieldDef.maxLength?: number` em `src/components/crud/types.ts`, repassado como `maxLength` ao `Input` e ao `Textarea` em `src/components/crud/entity-form.tsx`. Verificação: `npm run build` sem erro de tipo; checagem manual em `/contratos/new` (não deixa digitar o 46º caractere em *Nº do processo*).
- [ ] 2.2 `EntityForm` ganha `deleteDescription?: string` (padrão = texto atual do `AlertDialogDescription`). Verificação: `npm run build`; checagem manual: telas de outras entidades mantêm o texto antigo.

## 3. Cadastro de contratos

- [ ] 3.1 `contratosSchema` (`src/lib/entities/contratos.server.ts`): `.max(45)` em `numeroProcesso`/`numeroContrato` (mantendo `// RK-776d8b62d6df` e `// RK-04fd1cbfc346`), `.max(12)` em `numeroModalidade`, `.max(200)` em `objeto` só neste schema (mantendo `// RK-879233539305 RK-ee6cd831c2d4`), com `MSG.maximo`. Comentário `// Limites das telas do legado (docs/legado/rk-conferencia.md)`. Verificação: testes dos cenários *Número do processo com 46 caracteres* e *Objeto no limite*, mais um por campo restante (contrato 46, modalidade 13, objeto 201).
- [ ] 3.2 `naPresidencia` (0/1, padrão 0 na criação) e `numeroFiscais` (`^\d{1,3}$`, mensagem "Número de fiscais inválido", vazio → `null`) no schema e no `beforeSave`. Verificação: testes *Marcar contrato na Presidência*, *Padrão desligado*, *Informar o número de fiscais*, *Valor inválido* e `naPresidencia = 2` → `400`.
- [ ] 3.3 `projetoBasico`: `storedPdf()` no schema e entrada em `FILE_RULES` com `ANEXO_CONTRATO` (comentário dizendo que reaproveita a mensagem de `RK-ed7bc4aaba15`, sem RK própria). Verificação: testes *Enviar o projeto básico*, *Projeto básico que não é PDF* (PNG → 400, nenhum contrato gravado) e texto no corpo → "Envie o arquivo em PDF"; teste *Editar sem trocar o projeto básico*.
- [ ] 3.4 `src/lib/entities/contratos.ts`: campos na ordem de `design.md` (`numeroFiscais` masked `###` e `naPresidencia` toggle `[1, 0]` em "Partes e responsáveis"; `projetoBasico` `kind: "file"` em "Documentos"); `maxLength` nos quatro campos com limite. Verificação: atualizar o teste "Criar Contratos: formulário com os campos na ordem da spec" para a nova ordem (cenário *Ordem dos campos*) e conferir `maxLength` (cenário *Limite no formulário*).

## 4. Página do contrato

- [ ] 4.1 `src/lib/contratos/vigencia.ts` com `diasAte` e `vigencia` puros (recebem `now`); a página usa `vigencia(c.dataInicio, c.dataTermino)` e o texto "Vigência <dataInicio> a <dataTermino>"; remover `fimFinal`, `prorrogado` e "Vencimento com aditivos" de `src/app/(app)/contratos/[id]/page.tsx`. Comentário `// Vigência só pela data do próprio contrato (diretiva do autor 13/11/2026)`. Verificação: teste unitário de `vigencia` (vencido, vence hoje, vence em N ≤ 60, vigente, a iniciar) e teste do cenário *Contrato vencido com aditivo posterior* chamando `vigencia` com as datas de `getContratoDetalhe`; checagem manual na página.
- [ ] 4.2 Seção "Partes e responsáveis" mostra *Número de fiscais* e *Localizado na Presidência* (Sim/Não); seção "Anexos" ganha *Projeto básico* com `PdfLink` (*Ver PDF*) e "—" quando vazio; "Projeto básico" sai de "Identificação". Verificação: cenários *Contrato com projeto básico* e *Contrato sem projeto básico* por teste de renderização da página (ou checagem manual registrada no PR); `GET /api/arquivos/<nome>` sem sessão → `401` (teste já existente em `tests/security.test.ts` continua verde).
- [ ] 4.3 `getContratoDetalhe` devolve `andamentos` (de `contrato_status` do contrato, `dataInclusao desc, id desc`, com `status.nome` e `users.username` resolvidos em lote). Verificação: teste *Ver a linha do tempo* (ordem e isolamento por contrato) e *Contrato sem andamento* sobre o retorno de `getContratoDetalhe`.
- [ ] 4.4 `src/components/contratos/andamento-form.tsx` (lookup de `/api/status`, `Textarea`, `Switch`, `Button`, erros inline, `toast`, `router.refresh()`) posta em `POST /api/contrato_status` com `contratoId` da página; seção *Andamento* com o formulário e a linha do tempo. Regras aplicadas onde já estão: `RK-a7017eb6c42d`/`RK-067d06861847` em `src/lib/entities/status.rules.ts` (`statusIdField`), `RK-f0ce91a53de9` em `contratoStatusFields.descricao`. Verificação: testes *Registrar um andamento* e *Andamento sem status* contra `POST /api/contrato_status`; checagem manual do refresh na página.
- [ ] 4.5 `src/components/contratos/print-button.tsx` (*Imprimir*, `window.print()`), cabeçalho só de impressão com número, data/hora e usuário; `print:hidden` nos botões da página, no formulário de andamento, no `AppSidebar` e no `header` de `src/app/(app)/layout.tsx`; bloco `@media print` em `src/app/globals.css` (A4, 15 mm, fundo branco, `break-inside: avoid`, `thead` repetido). Verificação: checagem manual (pré-visualização de impressão do Chrome, temas claro e escuro) dos cenários *Imprimir um contrato* e *Cabeçalho na folha impressa*; `npm run build`.

## 5. Painel Início

- [ ] 5.1 `contratosVencendoAte(limite, hoje)` em `contratos.server.ts` (`parentId: null`, `dataTermino <= limite`, sem aditivos; vencimento = `dataTermino`) usado por `src/app/(app)/page.tsx`, com os textos novos de `design.md`. Comentário `// Vigência só pela data do próprio contrato (diretiva do autor 13/11/2026)`. Verificação: testes *Painel Início ignora o aditivo* e *Contrato vencendo com aditivo* sobre `contratosVencendoAte`.

## 6. Exclusão

- [ ] 6.1 `removeContrato` em `contratos.server.ts` (bloqueio por aditivos, pagamentos, penalidades, prestações de contas com `409` e lista em singular/plural; transação apagando `anexos_publicacao`, `anexos_fiscais`, `contrato_status`, `historicos`, `fiscais` e o contrato; `removeStoredPdf` depois do commit) e `contratosApi.remove = removeContrato` em `src/app/api/contratos/[id]/route.ts`. Verificação: testes *Excluir com confirmação*, *Contrato com aditivo e pagamento* (mensagem exata, nada apagado), *Anexos excluídos junto* (linhas e arquivos), um teste por tipo que bloqueia (penalidade, *Contrato com prestação de contas*), cobrindo os requisitos *Excluir Contratos*, *Exclusão de contrato bloqueada por vínculos* e *Exclusão de contrato apaga anexos e arquivos*, `404` para id inexistente e `401` sem sessão.
- [ ] 6.2 `/contratos/[id]/edit` passa `deleteDescription` com o texto de `design.md` › Exclusão. Verificação: checagem manual (diálogo mostra o texto; `409` aparece no toast com a mensagem da API).

## 7. Verificação

- [ ] 7.1 Um teste por `#### Scenario:` de `specs/contratos/spec.md` (os de impressão por checagem manual registrada no PR); `npm test` verde, incluindo `tests/rk-coverage.test.ts`.
- [ ] 7.2 `npm run lint` e `npm run build` sem erro.
- [ ] 7.3 `openspec validate 020-contratos-complementos --strict` passa.
