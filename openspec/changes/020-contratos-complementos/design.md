# Design

## Context

Estado atual (código construído pelas changes 001–018):

- `prisma/schema.prisma` › `Contrato` já tem `projetoBasico String?`, `naPresidencia Int?` e `numeroFiscais String?` (colunas da fundação). `projetoBasico` é um textarea no formulário (`src/lib/entities/contratos.ts`); os outros dois estão fora dele (`017-contratos/design.md` › Risks).
- `contratosSchema` (`src/lib/entities/contratos.server.ts`) não limita tamanho de texto.
- A página `/contratos/[id]` calcula `fimFinal` = maior `dataTermino` entre contrato e aditivos e usa isso no selo e na linha "Vigência … a …"; mostra ainda "Vencimento com aditivos". O painel Início (`src/app/(app)/page.tsx` › `contratosAte`) faz o mesmo cálculo.
- `DELETE /api/contratos/:id` usa o `remove` genérico do kit (`src/lib/crud/server.ts`): com aditivos o banco recusa (P2003 → `409 "Registro em uso por outro cadastro"`); sem aditivos apaga o contrato e deixa órfãos (só `parentId` é FK para `contratos`; `pagamentos`, `penalidades`, `prestacao_contas`, `historicos`, `fiscais`, `contrato_status`, `anexos_publicacao` e `anexos_fiscais` guardam `contratoId` sem FK).
- `contrato_status` (`004-contrato-status`) tem `contratoId`, `statusId` (`RK-a7017eb6c42d`, `RK-067d06861847`, em `src/lib/entities/status.rules.ts`), `descricao` (`RK-f0ce91a53de9`), `atendido` (`1`/`0`), `dataInclusao` e `usuarioId` preenchidos pelo servidor; a API aceita `?contratoId=`.

Evidência do legado: `docs/legado/contratos-complementos.md` (telas de `contratos_controller.php` e `models/contrato.php`), `docs/legado/rk-conferencia.md` (divergência de tamanhos), `docs/legado/relatorios.md` (uso de `projeto_basico` e `na_presidencia`).

### Campos novos ou alterados no formulário

| Campo | Rótulo | Componente (kit / shadcn) | Máscara | Comportamento | Obrigatório | Origem |
|---|---|---|---|---|---|---|
| numeroProcesso | Nº do processo | input | — | `maxLength` 45; `zod .max(45)` | sim (`RK-776d8b62d6df`) | rk-conferencia.md |
| numeroContrato | Nº do contrato | input | — | `maxLength` 45; `zod .max(45)` | sim (`RK-04fd1cbfc346`) | rk-conferencia.md |
| numeroModalidade | Nº da modalidade | input | — | `maxLength` 12; `zod .max(12)` | não | rk-conferencia.md |
| objeto | Objeto | textarea | — | `maxLength` 200; `zod .max(200)` | sim (`RK-879233539305`, `RK-ee6cd831c2d4`) | rk-conferencia.md |
| numeroFiscais | Número de fiscais | input com máscara (`kind: "masked"`, `mask: "###"`) | `###` (só dígitos) | inteiro 0–999, gravado como texto na coluna `String?` | não | contratos-complementos.md (tela adicionar) |
| naPresidencia | Localizado na Presidência | switch (`kind: "toggle"`, `toggleValues: [1, 0]`) | — | grava `1`/`0`; padrão `0` | não | contratos-complementos.md (tela editar, BOOLEAN) |
| projetoBasico | Projeto básico (PDF) | input file (`kind: "file"`) | — | `savePdf()`; na edição, sem arquivo novo mantém o atual | não | contratos-complementos.md ("Projeto Básico (.pdf)") |

Ordem do formulário (create e edit): `numeroProcesso`, `numeroContrato`, `tipoContratoId`, `modalidadeId`, `numeroModalidade`, `objeto`, `departamentoId`, `prestadorServicoId`, `pessoaFisicaId`, `suplenteId`, `numeroFiscais`, `naPresidencia`, `dataInicio`, `dataTermino`, `valorMensal`, `valorTotal`, `situacaoContratualId`, `projetoBasico` e anexos. `numeroFiscais` e `naPresidencia` ficam na seção "Partes e responsáveis"; `projetoBasico` passa para a seção "Documentos".

## Goals / Non-Goals

**Goals:**
- Fechar as lacunas do cadastro documentadas em `docs/legado/contratos-complementos.md` sem inventar campo nem regra.
- Aplicar a diretiva do autor: vigência só pela data do próprio contrato.
- Exclusão que nunca deixa registro nem arquivo órfão.

**Non-Goals:**
- Permissões por perfil (023), relatórios (change de relatórios), migração de dados (025).
- Novo modelo de dados para o andamento: reaproveita `contrato_status` como no legado (HABTM `Status` via `contrato_status`).

## Decisions

### Projeto básico em PDF
- `projetoBasico` entra em `FILE_RULES` de `contratos.server.ts` com a regra `ANEXO_CONTRATO` (mensagens "Erro ao incluir Não existe arquivo para anexar!" / "Erro ao incluir O arquivo anexo deve ser do tipo PDF!"). O legado documentado não traz mensagem própria para o projeto básico; reaproveita-se a do anexo do contrato (`RK-ed7bc4aaba15`) sem atribuir RK nova (ver Open Questions).
- No schema, `projetoBasico: storedPdf()` substitui `clearableString()`: texto digitado no corpo é recusado com "Envie o arquivo em PDF" (mesma regra dos outros anexos). Arquivo vazio = campo ausente = mantém o valor atual.
- Página: `projetoBasico` sai de "Identificação" e entra na seção "Anexos" como item "Projeto básico" com `PdfLink` (*Ver PDF*, `/api/arquivos/<nome>`, nova aba). Sem arquivo: "—".
- **Migração só de dados** `prisma/migrations/<timestamp>_020_contratos_complementos/migration.sql`:
  `UPDATE "contratos" SET "projetoBasico" = NULL WHERE "projetoBasico" IS NOT NULL AND NOT (length("projetoBasico") = 40 AND substr("projetoBasico", 37) = '.pdf' AND substr("projetoBasico", 1, 36) NOT GLOB '*[^0-9a-f-]*');`
  Produção ainda não tem dados (sem dump, diretiva de 13/11/2026); só bases de desenvolvimento/demonstração perdem o texto.

### Presidência e número de fiscais
- `naPresidencia` continua `Int?` (o BOOLEAN do MySQL legado é `TINYINT`): `zod` aceita `0`/`1` (coerção de `"0"`/`"1"`), ausente na criação grava `0`. Página: "Localizado na Presidência: Sim/Não" em "Partes e responsáveis".
- `numeroFiscais` continua `String?` (tipo da fundação). `zod`: vazio → `null`; senão `^\d{1,3}$` com a mensagem "Número de fiscais inválido"; grava o texto normalizado sem zeros à esquerda. Página: "Número de fiscais" em "Partes e responsáveis".
- Os dois aparecem em criar e editar. O legado tinha `numeroFiscais` só em *adicionar* e `naPresidencia` só em *editar*; mostrar ambos nas duas telas evita um campo que não pode ser corrigido e um que não pode ser informado de início (o kit usa a mesma lista de campos nas duas telas).

### Limites de tamanho
- `MSG.maximo(campo, n)` em `src/lib/rules/messages.ts` → `"<campo> deve ter no máximo <n> caracteres"`.
- `contratosSchema`: `numeroProcesso` e `numeroContrato` = `requiredString(...)` + `.max(45, MSG.maximo("Nº do processo"|"Nº do contrato", 45))`; `numeroModalidade` = `clearableString()` com `.max(12)`; `objeto` = `contratoFields.objeto` com `.max(200, MSG.maximo("Objeto", 200))` aplicado **só** no schema de contratos (o `contratoFields.objeto` compartilhado não muda). O limite é contado depois do `trim`.
- Kit: `FieldDef.maxLength?: number`, repassado como atributo `maxLength` ao `Input`/`Textarea` em `entity-form.tsx`. O servidor é a autoridade (o atributo HTML é só conveniência).
- Sem RK: a conferência (`docs/legado/rk-conferencia.md`) achou os limites nas telas, não em regras.

### Impressão
- `src/components/contratos/print-button.tsx` (client): `Button variant="outline"` com ícone `PrinterIcon`, rótulo *Imprimir*, `onClick={() => window.print()}`; ao lado de *Editar* na página.
- `src/app/(app)/layout.tsx`: `AppSidebar` e o `header` do app recebem `print:hidden` (variante `print:` do Tailwind); o `SidebarInset` fica sem margem na impressão.
- Página `/contratos/[id]`: botões (*Contrato original*, *Editar*, *Imprimir*, *Novo aditivo*) e o formulário de andamento com `print:hidden`; um cabeçalho só de impressão (`hidden print:block`): "DETRAN-RJ — Contrato nº <numeroContrato>" e "Impresso em dd/MM/yyyy HH:mm por <username>".
- `src/app/globals.css`, bloco `@media print`: `@page { size: A4; margin: 15mm; }`; fundo branco e texto preto (desliga o tema escuro); `section { break-inside: avoid; }`; tabelas com largura total e cabeçalho repetido (`thead { display: table-header-group; }`); links *Ver PDF* imprimem só o texto.

### Andamento (fluxo do contrato)
- Modelo: `contrato_status` como está; nenhuma coluna nova. `aditivoId` não é usado (Open Questions).
- Gravação: o formulário da página envia `POST /api/contrato_status` com `contratoId` = id da página, `statusId`, `descricao`, `atendido` (`1`/`0`). Reaproveita schema estrito, `statusIdField` (`RK-a7017eb6c42d`, `RK-067d06861847`), a normalização de `descricao` (`RK-f0ce91a53de9`), `dataInclusao` do servidor e `usuarioId` da sessão (`withAuthor`).
- Componente `src/components/contratos/andamento-form.tsx` (client): `OptionSelect`/lookup do kit para Status (`/api/status`, rótulo `nome`), `Textarea` para descrição, `Switch` para *Atendido*, `Button` *Registrar andamento*; erros `400 { errors }` inline no campo; sucesso → `toast.success("Andamento registrado.")`, limpa o formulário e `router.refresh()`.
- Linha do tempo: `getContratoDetalhe` passa a trazer `andamentos` = `contrato_status` do contrato ordenados por `dataInclusao desc, id desc`, com `status.nome` e `users.username` resolvidos em lote (sem FK nova, como já se faz com gestor/suplente). Cada item: data/hora (`dd/MM/yyyy HH:mm`), nome do status, selo *Atendido*/*Pendente*, descrição e usuário. Vazio: "Nenhum andamento registrado."
- O cadastro `/contrato_status` continua existindo como está (capability `contrato-status` sem alteração).

### Vigência pela data do próprio contrato
- `src/lib/contratos/vigencia.ts` exporta `diasAte(fim, now)` e `vigencia(inicio, fim, now)` (movidos da página, puros, testáveis). A página chama `vigencia(c.dataInicio, c.dataTermino)` e mostra "Vigência <dataInicio> a <dataTermino>". Somem `fimFinal`, `prorrogado` e o item "Vencimento com aditivos".
- Painel Início: `contratosAte` vira `contratosVencendoAte(limite, hoje)` em `contratos.server.ts`, com `where: { parentId: null, dataTermino: { lte: limite } }`, sem carregar aditivos; `vencimento = dataTermino`. Textos: "Contratos cujo vencimento (data do próprio contrato) cai nos próximos 30 dias." e "Vencimento nos últimos 90 dias." (sai "sem aditivo que a prorrogue").
- Aditivos seguem com as próprias datas, na tabela de aditivos e na própria página do aditivo.
- A lista `/contratos` e o filtro `vencendoEm` já usam a `dataTermino` de cada linha; não mudam.

### Exclusão de contrato
- `contratosApi.remove` deixa de ser o `crud.remove` genérico e passa a ser `removeContrato` em `contratos.server.ts` (handler próprio, como `list`):
  1. `requireUser()`; id inválido ou inexistente → `404`.
  2. Conta dependentes que **bloqueiam**: aditivos (`contratos.parentId`), `pagamentos`, `penalidades`, `prestacao_contas` com `contratoId = id`. Se algum > 0 → `409 { error: "Não é possível excluir o contrato: há <lista> vinculados. Exclua-os antes." }`, onde `<lista>` junta só os não zerados no formato "2 aditivos, 1 pagamento, 1 penalidade, 3 prestações de contas" (singular/plural). Nada é apagado.
  3. Senão, numa `prisma.$transaction`: lê os nomes de arquivo (`contratos.anexo`, `contratos.projetoBasico`, `anexos_publicacao.anexo`, `anexos_fiscais.anexo`), apaga `anexos_publicacao`, `anexos_fiscais`, `contrato_status`, `historicos`, `fiscais` do contrato e o contrato.
  4. Depois do commit, `removeStoredPdf(nome)` (nova em `src/lib/uploads.ts`: só nomes do padrão de `savePdf`, ignora arquivo inexistente) para cada arquivo lido. Falha ao apagar arquivo é registrada no log do servidor e não desfaz a exclusão.
  5. `204`.
- Tela: `EntityForm` ganha `deleteDescription?: string` (padrão = texto atual); a edição de contrato passa "O contrato e seus anexos, andamentos, históricos e fiscais serão excluídos definitivamente. Esta ação não pode ser desfeita." O `409` já aparece no toast pelo `data.error` do formulário.
- **Coordenação com a 024 (kit):** se a 024 criar um gancho genérico de dependentes/cascata no `crudHandlers`, ela SHALL migrar `removeContrato` para ele mantendo as mesmas listas (bloqueia / apaga junto), a mesma mensagem e os mesmos status HTTP. `maxLength` e `deleteDescription` são props opcionais novas do kit que a 024 SHALL preservar.

## Risks / Trade-offs

- [Textos antigos de `projetoBasico` apagados pela migração] → só existem em bases de desenvolvimento/demonstração; produção não tem dados.
- [Registros com mais de 45/200/12 caracteres em bases de desenvolvimento] → passam a dar `400` ao editar até serem encurtados; o legado já limitava, então dados migrados cabem.
- [PDF apagado do disco sem o banco (ou o contrário)] → arquivos só são apagados depois do commit; uma falha deixa no máximo arquivo órfão no disco, nunca link quebrado.
- [`historicos` e `fiscais` apagados junto] → são dados do próprio contrato; se o autor quiser preservá-los, passam para a lista que bloqueia (Open Questions).
- [Kit alterado por duas changes (020 e 024)] → mudanças da 020 no kit são props opcionais, sem mudar comportamento padrão.

## Open Questions

- **Mensagem do projeto básico:** o legado tinha mensagem própria para projeto básico que não é PDF? Conferir com `getSourceFile` em `contratos_controller.php`; hoje reaproveita a de `ANEXO_CONTRATO`.
- **Tipo de `numeroFiscais`:** a coluna legada é numérica ou texto, e há limite? Decisão provisória: inteiro de 0 a 999 gravado como texto.
- **Fluxo × `status.fluxo`:** a tela `contratos/fluxo` filtrava os status pelo campo `status.fluxo` (ou `periodo`)? Hoje o select mostra todos os status.
- **`contrato_status.aditivoId`:** quando o legado preenchia? Hoje o andamento grava só `contratoId` (o de quem está na página, original ou aditivo).
- **Cadastro solto `/contrato_status`:** continuar no menu ou sair dele agora que o andamento é registrado no contrato? Decisão do autor.
- **Exclusão:** o legado (`contratos/remover`) apagava dependentes, bloqueava ou deixava órfãos? Não está em `docs/legado/`; a regra acima é decisão desta change. Confirmar se `historicos` e `fiscais` devem bloquear em vez de serem apagados.

### Registro da aplicação (onda 2, 14/11/2026)

- **Exclusão pelo `beforeDelete` da 024.** Não há `removeContrato` separado: `contratosApi.remove` continua `crud.remove`, com `beforeDelete` (`prepararExclusao` em `contratos.server.ts`) na transação do kit. Ele conta aditivos, pagamentos, penalidades e prestações de contas e lança `ConflictError` (`409 { error }`) com a lista em singular/plural; senão apaga `anexos_publicacao`, `anexos_fiscais`, `contrato_status`, `historicos` e `fiscais` e agenda (`files.discard`) os PDFs dos anexos. O kit apaga o contrato, agenda `anexo` e `projetoBasico` (ambos em `fileFields`) e só depois do commit tira os PDFs do disco. `404` (id inexistente) e `401` vêm do kit.
- **`removeStoredPdf` (tarefa 1.2)** não foi criada: a 024 já entregou `deleteStoredPdf` em `src/lib/uploads.ts` com o mesmo contrato (só nomes de `savePdf`, ignora inexistente, nunca sai de `uploadDir()`), testada em `tests/uploads.test.ts`.
- **`FILE_RULES` (tarefa 3.3)** não existe mais desde a 024: `projetoBasico` entrou em `fileFields` com `ANEXO_CONTRATO`. O kit tira o campo do schema validado; `storedPdf()` fica no schema só como documentação da forma gravada. Texto no corpo → "Envie o arquivo em PDF" (kit).
- **Kit (tarefas 2.1 e 2.2)** já vieram da 024 (`FieldDef.maxLength` com contador, `EntityForm.deleteDescription`); a 020 só os usa.
- **`naPresidencia` vazio** (registro antigo com `null` e interruptor não tocado na edição, que envia `""`) é gravado como `0`; valor diferente de `0`/`1` → `400` "Localizado na Presidência inválido" (mensagem desta change, sem legado).
- **Data e hora** (linha do tempo e cabeçalho de impressão) no fuso do servidor (`src/lib/contratos/data-hora.ts`), pois `dataInclusao` do andamento guarda o instante real.
- **Impressão — dependência da 019.** A 020 não edita `src/app/globals.css` nem `src/app/(app)/layout.tsx` (são da 019, aplicada em paralelo): a folha global de impressão (`@media print`, A4, fundo branco, `thead` repetido) e o `print:hidden` no menu lateral e no cabeçalho do app vêm da 019. Na página do contrato a 020 usa só utilitários `print:*` do Tailwind: `print:hidden` nos botões e no formulário de andamento, cabeçalho `hidden print:block`, `print:break-inside-avoid` nas seções. Conferido em pré-visualização com mídia `print` emulada.
- **Teste da migração de dados (1.1)** está em `tests/contratos-complementos.test.ts` (roda o SQL do `migration.sql` no banco de teste), não em `tests/contratos.test.ts`.
- **Andamento mostra "Status removido"** quando o `statusId` do registro não existe mais em `status` (sem FK).
