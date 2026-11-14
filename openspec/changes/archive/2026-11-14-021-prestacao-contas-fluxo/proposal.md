# Prestação de contas: pendentes, realizadas e fluxo por contrato

## Why

No legado, prestação de contas é um processo sobre contratos (`prestacao_contas_controller.php`,
`models/prestacao_conta.php`; evidência em `docs/legado/prestacao-contas.md`): a tela `prestacao`
lista os contratos que **precisam** prestar contas (tipos configurados, contrato original, vencido,
valor total acima de R$ 650.000,00), separados em pendentes e realizadas; a tela `fluxo` registra,
fase a fase, o andamento de um contrato, e a fase final atendida conclui a prestação
(`contratos.prestacao_realizada = 1`).

A `008-prestacao-contas` entregou só um cadastro solto de `prestacao_contas` (descrição, atendido,
fase e contrato escolhidos à mão). Esse cadastro não mostra quais contratos devem prestar contas,
não aplica a regra de conclusão e permite editar e apagar registros do andamento. A coluna
`contratos.prestacaoRealizada` existe (017) mas nada a grava.

## What Changes

- **Tela "Prestação de contas › Pendentes / Realizadas"** em `/prestacao_contas`, substituindo a
  lista do cadastro solto: contratos que atendem aos critérios do legado, abas Pendentes/Realizadas,
  busca por coluna (UN gestora, gestor, contratada, nº contrato, nº processo, objeto), ordenação
  (contratada, vencimento, valor asc/desc, UN gestora, gestor), filtros de tipo e modalidade,
  10 por página, colunas do legado (processo, contrato, vencimento, objeto, dias, valor total,
  contratada, UN gestora).
- **Tipos de contrato configuráveis**: nova coluna `tipo_contrato.prestacaoContas` ("S"/"N",
  padrão "N"), com toggle no formulário de tipos de contrato, no lugar da lista fixa de ids do
  legado (3, 4, 5, 6, 7, 8, 9, 10, 11, 13).
- **Limite de valor**: `valorTotal > 650.000,00` fica como constante única no código
  (`PRESTACAO_VALOR_MINIMO`), não como configuração (ver `design.md` › Decisions).
- **Fluxo por contrato** em `/prestacao_contas/[contratoId]`: painel do contrato (dias desde o
  vencimento, meses desde o início, situação), escolha do prazo (valores de `fases.periodo`), fases
  do prazo com a última descrição e o "atendido", gravação de uma fase e histórico somente leitura.
- **Regra de conclusão**: gravar a fase de período 30 com atendido = "S" marca
  `contratos.prestacaoRealizada = "1"`, na mesma transação.
- **Autoria pela sessão** (já é regra da `001b-security-baseline`): `userId` e `dataInclusao` do
  servidor.
- **Cadastro solto substituído**: saem `/prestacao_contas/new`, `/prestacao_contas/[id]/edit`,
  `PUT` e `DELETE` de `/api/prestacao_contas/:id` (**BREAKING** para quem usava essas rotas).
  Os registros continuam visíveis, só leitura, no histórico do fluxo.

## Capabilities

### New Capabilities

_none_

### Modified Capabilities

- `prestacao-contas`: deixa de ser cadastro solto e passa a ser o processo do legado — lista de pendentes/realizadas, fluxo por contrato, conclusão automática e histórico só leitura.
- `tipo-contratos`: ganha a marcação "Sujeito à prestação de contas", que define quais tipos entram na lista de prestação de contas.

## Impact

- Prisma: coluna `prestacaoContas String @default("N")` em `TipoContrato` (migração
  `021_prestacao_contas_fluxo`). `PrestacaoConta` e `Contrato.prestacaoRealizada` não mudam de tipo.
- API: novas `GET /api/prestacao_contas/contratos` e `GET /api/prestacao_contas/contratos/:id`;
  `POST /api/prestacao_contas` passa a aplicar a regra de conclusão; `GET /api/prestacao_contas`
  ganha filtro `contratoId`; `PUT`/`DELETE /api/prestacao_contas/:id` são removidos.
- Telas: `src/app/(app)/prestacao_contas/page.tsx` reescrita; nova `src/app/(app)/prestacao_contas/[contratoId]/page.tsx`;
  removidas `new/` e `[id]/edit/`. Formulário de `/tipo_contratos` ganha um toggle.
- Kit: `EntityList` ganha as props opcionais `pageSize` e `extraParams` (compatíveis com as listas atuais).
- Componente shadcn/ui `tabs` adicionado (`npx shadcn@latest add tabs`).
- Dados do legado: ao carregar o dump, a `025` deve gravar `prestacaoContas = "S"` nos tipos de id
  3, 4, 5, 6, 7, 8, 9, 10, 11 e 13 e trazer `prestacao_realizada` 0/1 como "0"/"1" e
  `prestacao_contas.atendido` 0/1 como "N"/"S".
- Permissão: nesta change, qualquer sessão válida acessa as telas (regra atual). A restrição ao
  perfil/permissão de prestação de contas (grupo `PrestacaoConta` do ACL legado,
  `docs/legado/perfis-acesso.md`) é entregue pela `023-perfis-acesso`, que vem depois e deve proteger
  `/prestacao_contas/**` e `/api/prestacao_contas/**`.

## Fora de escopo

- Desfazer a conclusão (voltar `prestacaoRealizada` para "0"): o legado só marca como realizada.
- Persistir o prazo escolhido em `contratos.periodo`: o legado documentado não diz que grava; ver Open Questions.
- `andamento_prestacao` (pesquisa de andamento em `contratos`) e o fluxo por status (`contratos/fluxo`, `contrato_status`): pertencem a outras telas do legado.
- Impressão/exportação da lista de prestação de contas.
- Tornar o limite de R$ 650.000,00 editável pela interface.
- Restrição de acesso por perfil (vai na `023-perfis-acesso`).

Depende de: 003-tipo-contratos, 008-prestacao-contas, 009-fases, 017-contratos (arquivadas). Não depende da 023: é a 023 que aplica a permissão de prestação de contas sobre as rotas desta change.
