# Complementos do cadastro de contratos

Depende de: 001b-security-baseline, 004-contrato-status, 011-status, 017-contratos (todas arquivadas).
Coordena com (sem depender, pois aplicam depois): 024 (kit de CRUD) e 025 (migração do legado); ver § Impact.

## Why

A `017-contratos` entregou o cadastro, mas deixou de fora o que o legado tinha e que agora está
documentado em `docs/legado/contratos-complementos.md` (lido do MCP da RNC em 13/11/2026):

- **Projeto básico** é um arquivo PDF no legado ("Projeto Básico (.pdf)"); no app novo virou textarea (erro do pacote gerado). O relatório "Cadastro incompleto" depende de `projeto_basico IS NULL` (`docs/legado/relatorios.md`).
- **Localizado na Presidência** (`na_presidencia`, BOOLEAN) e **Número de fiscais** (`numeroFiscais`) existem nas telas do legado e ficaram fora do formulário "até confirmação"; a confirmação veio do MCP.
- **Tamanhos máximos** das telas (processo e contrato 45, objeto 200, nº da modalidade 12): divergência registrada em `docs/legado/rk-conferencia.md`; o app novo não limita.
- **Impressão** da visualização do contrato (ação PRINT em `contratos/visualizar`).
- **Fluxo do contrato** (`contratos/fluxo`): andamento do contrato por status, gravado em `contrato_status` (`descricao`, `atendido`). No app novo `contrato_status` é um cadastro solto, sem ligação visível com o contrato.

Além disso, dois defeitos registrados:

- **Vigência pelos aditivos.** O selo da página do contrato (`src/app/(app)/contratos/[id]/page.tsx`) e o painel Início (`src/app/(app)/page.tsx`) usam o maior vencimento entre o contrato e seus aditivos. A diretiva do autor (13/11/2026, `openspec/config.yaml`) manda usar **só** a `dataTermino` do próprio contrato.
- **Exclusão de contrato.** Hoje responde `409 "Registro em uso por outro cadastro"` quando há aditivos (FK `parentId`) e apaga o contrato deixando órfãos `anexos_publicacao`, `anexos_fiscais`, `contrato_status`, `historicos`, `fiscais`, `pagamentos`, `penalidades` e `prestacao_contas` (nenhum deles tem FK) e os PDFs no disco (`017-contratos/design.md` › Open Questions › Exclusão).

## What Changes

- `projetoBasico` passa a ser um PDF gravado por `savePdf()`; a página do contrato mostra *Ver PDF*. Migração de dados limpa os textos antigos da coluna.
- Formulário de contrato ganha *Localizado na Presidência* (switch, grava `1`/`0` em `naPresidencia`) e *Número de fiscais* (`numeroFiscais`, inteiro ≥ 0).
- Limites de tamanho do legado no schema `zod` (autoridade) e no `maxLength` dos campos: `numeroProcesso` e `numeroContrato` 45, `objeto` 200, `numeroModalidade` 12.
- Botão *Imprimir* na página `/contratos/[id]` e folha de estilo de impressão (menu, cabeçalho do app, botões e formulários somem; cabeçalho de impressão com data e usuário).
- Seção *Andamento* na página do contrato: registrar status (status, descrição, atendido) e linha do tempo dos registros de `contrato_status` do contrato.
- Vigência calculada só pela `dataInicio`/`dataTermino` do próprio contrato, no selo da página e no painel Início.
- Exclusão de contrato: bloqueada com `409` e mensagem que diz o que impede (aditivos, pagamentos, penalidades, prestações de contas); senão, apaga numa transação o contrato, seus anexos de publicação e fiscais, andamentos, históricos e fiscais, e depois os PDFs do disco.

## Capabilities

### New Capabilities

_nenhuma_

### Modified Capabilities

- `contratos`: projeto básico em PDF, Presidência, número de fiscais, limites de tamanho, impressão, andamento por status, vigência pela data do próprio contrato e regras de exclusão. A capability `contrato-status` não muda de requisito: o andamento usa a API `/api/contrato_status` existente.

## Impact

- **Código:** `src/lib/entities/contratos.ts`, `src/lib/entities/contratos.server.ts`, `src/app/api/contratos/[id]/route.ts`, `src/app/(app)/contratos/[id]/page.tsx`, `src/app/(app)/contratos/[id]/edit/page.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/globals.css`, `src/lib/uploads.ts` (nova `removeStoredPdf`), `src/lib/rules/messages.ts` (nova `MSG.maximo`), novos `src/lib/contratos/vigencia.ts`, `src/components/contratos/print-button.tsx`, `src/components/contratos/andamento-form.tsx`.
- **Kit (coordenação com a 024):** acrescenta `maxLength?: number` em `FieldDef` (`src/components/crud/types.ts`) e a prop `deleteDescription?: string` em `EntityForm` (`src/components/crud/entity-form.tsx`). São aditivos opcionais; a 024 SHALL preservá-los (ou substituí-los por equivalente) e SHALL manter o contrato de resposta da exclusão de contratos (`409 { error }`, exibido pelo toast do formulário). A 020 não depende da 024: aplica antes dela, pela ordem numérica.
- **Banco:** nenhuma coluna nova (`projetoBasico String?`, `naPresidencia Int?` e `numeroFiscais String?` já existem desde a fundação). Uma migração só de dados zera `projetoBasico` que não seja nome gerado por `savePdf`.
- **Migração do legado (025):** o carregador SHALL levar o arquivo de `projeto_basico` do legado como PDF gravado por `savePdf` (ou `NULL`) e `na_presidencia` como `1`/`0`; textos acima dos limites não existem no legado (as telas já limitavam).
- **Relatórios:** o "Cadastro incompleto" (change de relatórios) passa a poder usar `projetoBasico IS NULL` como o legado; o "Acompanhamento de meta" passa a ter `naPresidencia` preenchível.
- **Perfis (023):** quem pode registrar andamento, imprimir e excluir é definido na 023-perfis-acesso; aqui vale qualquer sessão válida, como hoje.

## Fora de escopo

- Impressão da lista de contratos em vigor (`contratos/index` PRINT) e das visões `visualizar_restrito`/`visualizar_resumo`: ficam para a change de relatórios e para a 023-perfis-acesso.
- Tela *Andamento* do legado (`contratos/andamento`, `andamento_prestacao`): a pesquisa de contratos vencendo/vencidos já é coberta pelos filtros da lista e pelos relatórios.
- Editar ou excluir um registro de andamento a partir da linha do tempo (continua possível no cadastro `/contrato_status`); filtrar os status pelo campo `status.fluxo`; vincular andamento a aditivo (`contrato_status.aditivoId`) — sem regra do legado documentada (ver design.md › Open Questions).
- Remover o projeto básico já enviado sem substituí-lo (o legado documentado não mostra essa ação).
- Exclusão em cascata de aditivos, pagamentos, penalidades e prestações de contas: a exclusão é bloqueada enquanto existirem.
- Contador de caracteres nos campos com limite.
