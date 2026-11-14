# Design — 023-perfis-acesso

## Context

Hoje qualquer usuário logado faz tudo: `requireUser()` (`src/lib/auth/session.ts`) só checa a sessão, e o menu (`src/lib/navigation.ts`) mostra todas as entidades. A Open Question de `001b-security-baseline/design.md` ("Permissões por grupo") ficou para depois, e a conferência das RK (`docs/legado/rk-conferencia.md`) devolveu a associação usuário–grupo para esta change.

Legado (`docs/legado/perfis-acesso.md`, lido do MCP da RNC em 13/11/2026: `40_seed_acl.sql`, `customacl.php`):

- ACL CakePHP por grupo; um usuário pode estar em vários grupos (`groups_users`) e a permissão é avaliada pelos grupos dele.
- Grupos: **Gestor**, **Pagamentos**, **ContratoCGCL**, **PrestacaoConta**. Todos têm CRUD na árvore `contratos`; a diferença está nos "papéis" `eGestor`, `ePagamentos`, `eContratoCGCL`, `ePrestacaoConta`.
- Visões reduzidas: `contratos/visualizar_restrito` e `visualizar_resumo` (dados do contrato sem anexos nem edição).
- Ações no ACL: index, adicionar, atualizar/editar, remover, visualizar, anexar, baixarPdf, fluxo, andamento, relatórios (gestores, vencendo, vencidos, cadastro, meta, acertoValor), prestação (prestacao, fluxo, manterPrestacao).
- O legado **não** associa usuário a unidade gestora para restringir contratos: todo grupo vê a árvore `contratos` inteira.

Decisão do autor (13/11/2026, `openspec/config.yaml`): perfis **Administrador, Gestor de contrato, Fiscal, Financeiro e Consulta**; um usuário pode ter mais de um.

## Goals / Non-Goals

**Goals**
- Catálogo fixo de perfis e matriz de permissões por recurso e ação, num único arquivo de código, usada pelo servidor e pela interface.
- Toda rota `/api/*` e toda página da área logada checam a permissão no servidor (`403`).
- A interface esconde o que o usuário não pode fazer (itens de menu, *Novo*, *Editar*, *Excluir*, anexos, *Exportar*).
- Gestão de perfis na tela de usuários, só para Administrador.
- Ninguém fica trancado para fora: o seed cria Administrador, a migração dá perfil a todos os usuários atuais e o último Administrador não pode ser removido.

**Non-Goals**
- Editor de permissões na tela (a matriz é código, revisada em PR).
- Restrição por unidade gestora ou por contrato (ver Decisions › Escopo e Open Questions).
- Carga dos usuários e grupos do legado: `025` usa o mapeamento definido aqui.

## Decisions

### Modelo de dados

Tabela nova `user_perfis` (migração `prisma/migrations/<timestamp>_023_perfis_acesso/migration.sql`):

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `Int` PK autoincremento | |
| `userId` | `Int` FK → `users.id`, `onDelete: Cascade` | |
| `perfil` | `String` | um de `ADMINISTRADOR`, `GESTOR_CONTRATO`, `FISCAL`, `FINANCEIRO`, `CONSULTA`; `CHECK` na migração e `z.enum` na API |
| | `@@unique([userId, perfil])`, `@@index([userId])` | |

```prisma
model UserPerfil {
  id     Int    @id @default(autoincrement())
  userId Int
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  perfil String
  @@unique([userId, perfil])
  @@map("user_perfis")
}
```

`User` ganha `perfis UserPerfil[]`. Por que não reaproveitar `groups`/`groups_users`: são tabelas de referência somente leitura do legado (`app-shell` › "Dados de referência somente leitura"), com nomes de grupo que não correspondem aos perfis decididos e um `acoId` de ACL que o app novo não usa; grupo criado por dado sem permissão no código não teria efeito. Elas continuam como referência e servem de origem para o mapeamento da migração e da 025. `String` + `CHECK` em vez de `enum` do Prisma para não depender do suporte a enum no SQLite.

`users.superuser` deixa de conceder qualquer coisa: só os perfis valem. A coluna fica (legado; usada uma vez na migração de dados abaixo).

### Catálogo e matriz (`src/lib/auth/permissions.ts`)

```ts
export const PERFIS = ["ADMINISTRADOR", "GESTOR_CONTRATO", "FISCAL", "FINANCEIRO", "CONSULTA"] as const;
export const PERFIL_LABEL = { ADMINISTRADOR: "Administrador", GESTOR_CONTRATO: "Gestor de contrato", FISCAL: "Fiscal", FINANCEIRO: "Financeiro", CONSULTA: "Consulta" };
export const ACOES = ["listar", "ver", "criar", "editar", "excluir", "anexar", "exportar"] as const;
export type Recurso = keyof typeof MATRIZ;
export const MATRIZ: Record<Recurso, Partial<Record<Perfil, Acao[]>>>;
export function can(user: { perfis: Perfil[] }, recurso: Recurso, acao: Acao): boolean; // união dos perfis
export function permissoesDe(perfis: Perfil[]): string[]; // ["contratos:listar", ...]
export class ForbiddenError extends Error {}
export async function requirePermission(recurso: Recurso, acao: Acao): Promise<SessionUser>; // 401 antes de 403
```

Ações: **listar** (lista/tela de pesquisa), **ver** (detalhe ou formulário em leitura), **criar**, **editar**, **excluir**, **anexar** (enviar PDF num campo de arquivo; exigida junto com criar/editar quando a requisição traz arquivo), **exportar** (PDF/Excel/impressão de relatório). Baixar um anexo exige **ver** no recurso dono do arquivo.

Legenda: L listar · V ver · C criar · E editar · X excluir · A anexar · R exportar · — nenhuma.

| Recurso (chave) | Telas e rotas | Administrador | Gestor de contrato | Fiscal | Financeiro | Consulta |
|---|---|---|---|---|---|---|
| `contratos` | `/contratos`, `/contratos/new`, `/contratos/[id]`, `/contratos/[id]/edit`, `/contratos/[id]/aditivos/new`; `/api/contratos`, `/api/contratos/:id`, `/api/contratos/:id/aditivos`; complementos da 020 (projeto básico em PDF, "Localizado na Presidência", impressão) | L V C E X A | L V C E A | L V | L V | L |
| `contratos_resumo` | visão restrita de `/contratos/[id]` e `GET /api/contratos/:id` (ver "Visão restrita") | V | V | V | V | V |
| `contrato_status` (fluxo do contrato) | `/contrato_status`, `/api/contrato_status`; tela de fluxo/andamento da 020 | L V C E X | L V C E | L V C E | L V | — |
| `historicos` | `/historicos`, `/api/historicos` | L V C E X | L V C E | L V C E | L V | — |
| `fiscais` | `/fiscais`, `/api/fiscais` | L V C E X | L V C E X | L V | L V | — |
| `anexos_fiscais` | `/anexos_fiscais`, `/api/anexos_fiscais` | L V C E X A | L V C E X A | L V C E A | L V | — |
| `anexos_publicacaos` | `/anexos_publicacaos`, `/api/anexos_publicacaos` | L V C E X A | L V C E X A | L V | L V | — |
| `penalidades` | `/penalidades`, `/api/penalidades` | L V C E X A | L V C E A | L V | L V | — |
| `pagamentos` | `/pagamentos`, `/api/pagamentos` | L V C E X | L V | L V | L V C E X | — |
| `prestacao_contas` | `/prestacao_contas`, `/api/prestacao_contas`; painel pendentes/realizadas e fluxo da 021 | L V C E X | L V C E | L V | L V | — |
| `relatorios` | relatórios da 019: por gestor, vencendo, vencidos, cadastro incompleto, acompanhamento de meta | L R | L R | L R | L R | L |
| `acerto_valor` | relatório "Acerto de valor" da 019 (grava `valorInicial`) | L E | — | — | — | — |
| `cadastros` | `departamentos`, `tipo_contratos`, `modalidades`, `situacao_contratuals` (e o alias `/api/situacao_contratual`), `fases`, `status` — telas e APIs | L V C E X | L V | L V | L V | L V |
| `referencia` | `GET /api/diretorias`, `/api/pessoas`, `/api/pessoas_fisicas`, `/api/prestadores_servicos`, `/api/pagamento_arquivos` | L | L | L | L | L |
| `users` | `/users`, `/users/new`, `/users/[id]/edit`, `/api/users`, `/api/users/:id`, `GET /api/groups`, `GET /api/groups_users`, perfis do usuário | L V C E X | — | — | — | — |

Sem permissão de recurso (só sessão): `/` (início), `/conta/senha` e `POST /api/conta/senha` (a própria senha), `GET /api/auth/me`, `POST /api/auth/logout`.

Origem de cada linha:

- **Administrador** ← grupo `ContratoCGCL` (gestão central, `docs/legado/perfis-acesso.md`): tudo, inclusive usuários, cadastros auxiliares, exclusão e acerto de valor.
- **Gestor de contrato** ← grupo `Gestor` (`eGestor`) e, por decisão desta change, também o papel `ePrestacaoConta` (ver abaixo): mantém contratos, fiscais, anexos, penalidades, fluxo, históricos e prestação de contas; não exclui contrato nem penalidade; só consulta pagamentos.
- **Financeiro** ← grupo `Pagamentos` (`ePagamentos`): mantém pagamentos; lê o resto do contrato.
- **Fiscal** (novo): registra andamento (fluxo e históricos) e relatórios de fiscalização (`anexos_fiscais`); lê o resto.
- **Consulta** (novo): só leitura, com a visão restrita do contrato (`visualizar_restrito`/`visualizar_resumo` do legado), cadastros e relatórios na tela, sem exportar.
- O legado dava CRUD da árvore `contratos` a todos os grupos. A matriz restringe a escrita conforme o perfil, porque os perfis novos foram criados exatamente para diferenciar o acesso; a divergência está em Open Questions.

### `PrestacaoConta` vira capacidade do Gestor de contrato

`docs/legado/perfis-acesso.md` pede avaliar se `PrestacaoConta` é perfil próprio ou capacidade do Gestor. Os cinco perfis do autor não incluem um perfil de prestação de contas; por isso a permissão de manter `prestacao_contas` (008 e painel/fluxo da 021) vai para Gestor de contrato e Administrador. No mapeamento do legado, `PrestacaoConta` → `GESTOR_CONTRATO`.

### Escopo do Gestor de contrato

O legado não restringe: todos os grupos têm acesso à árvore `contratos` inteira (`40_seed_acl.sql`), e `users` não tem unidade gestora (só `pessoaId`, ainda não confirmado — `005-users`). Padrão adotado: **Gestor de contrato vê e mantém todos os contratos**, como no legado. O mesmo vale para Fiscal e Financeiro. A restrição por unidade gestora (exigiria `users.departamentoId`) ou por ser gestor/suplente do contrato (exigiria ligar `users.pessoaId` ao CPF de `contratos.pessoaFisicaId`, ver `docs/legado/chaves-pessoas-fornecedores.md`) fica em Open Questions.

### Visão restrita do contrato (Consulta)

Quem tem `contratos_resumo:ver` e não tem `contratos:ver` recebe a **projeção restrita** (`src/lib/entities/contratos.server.ts` › `contratoResumo(row)`), na lista e no detalhe:

- Inclui: `id`, `numeroProcesso`, `numeroContrato`, tipo, modalidade, `numeroModalidade`, `objeto`, unidade gestora, fornecedor, nomes do gestor e do suplente, `dataInicio`, `dataTermino`, `valorMensal`, `valorTotal`, `valorInicial`, situação contratual, `parentId` e os aditivos (`id`, `numeroContrato`, `dataInicio`, `dataTermino`, `valorTotal`).
- Exclui: `anexo`, `anexoTipo`, `projetoBasico`, anexos de publicação e fiscais, fluxo, históricos, penalidades, pagamentos e prestação de contas.

`/contratos/[id]` para Consulta renderiza só os blocos da projeção, sem *Editar*, *Novo aditivo* nem links de anexo. `GET /api/arquivos/:nome` de anexo do contrato responde `403` para ele.

### Aplicação no servidor

- **Sessão**: `SessionUser` ganha `perfis: Perfil[]`; `getSessionUser()` inclui `perfis: { select: { perfil: true } }` na mesma consulta da sessão. A permissão é lida do banco a cada requisição (troca de perfil vale na próxima requisição, sem novo login) e nunca de cookie, corpo, URL ou header.
- **Kit** (`src/lib/crud/server.ts`, depois da 024): `CrudConfig.resource: Recurso` obrigatório. `list` → `listar`; `get` → `ver`; `create` → `criar`; `update` → `editar`; `remove` → `excluir`; corpo com arquivo (`Blob` não vazio em qualquer campo) → também `anexar`, checado **antes** de qualquer `savePdf` (nenhum arquivo gravado numa requisição negada). `ForbiddenError` → `403 { error: "Sem permissão para esta ação" }` em `handleError`.
- **Rotas fora do kit**: `createAditivo`/`listAditivos` (`contratos`: `criar`/`listar`), `removeUser` e `trocarSenha` (`users.server.ts`; a troca de senha só exige sessão), `referenceListHandler` (`src/lib/reference/route.ts`: `referencia:listar`; `groups` e `groups_users` → `users:listar`), `GET /api/arquivos/[nome]` (dono do arquivo, abaixo), `listFiscais` (via kit), rotas das 019, 020 e 021 com `requirePermission` (tabela acima).
- **Download** (`src/app/api/arquivos/[nome]/route.ts`): `findAttachmentOwner(nome)` procura o nome em `contratos.anexo`, `contratos.projetoBasico` (020), `anexos_fiscais.anexo`, `anexos_publicacao.anexo`, `penalidades.arquivo`; exige `ver` no recurso dono (`contratos` — não `contratos_resumo` —, `anexos_fiscais`, `anexos_publicacaos`, `penalidades`); nome sem dono → `404`.

### Aplicação na interface

- `src/lib/navigation.ts`: `NavItem.resource: Recurso`; `navByGroup(user)` mostra só itens com `listar`; grupo vazio some. Os itens novos das 019 (Relatórios), 020 e 021 (Prestação de contas) recebem `resource` da tabela. `src/app/(app)/layout.tsx` passa o usuário a `AppSidebar`.
- `src/lib/auth/guard.ts` › `guardPage(recurso, acao)`: em cada `page.tsx` da área logada (lista → `listar`; `new` → `criar`; `[id]/edit` → `editar`, ou `ver` em modo leitura; `[id]` → `ver` ou `contratos_resumo:ver`). Sem permissão, a página renderiza `<SemPermissao />` (componente com `Alert` do shadcn/ui: "Você não tem permissão para acessar esta página.") e não busca dados.
- Kit de telas: `EntityList` recebe `canCreate` (já existe) calculado por `can(user, recurso, "criar")`; `EntityForm` recebe `canDelete` (já existe) e `readOnly` (novo: campos desabilitados, sem *Salvar*) quando só há `ver`; campos `kind: "file"` somem sem `anexar`. Botões *Exportar*/*Imprimir* dos relatórios só com `exportar`.
- `GET /api/auth/me` devolve `{ user: { id, username, perfis, permissoes } }` (`permissoes` = `permissoesDe(perfis)`), para componentes cliente que precisem esconder ações.

### Gestão de perfis na tela de usuários

- `users` (`src/lib/entities/users.ts`): coluna "Perfis" (rótulos de `PERFIL_LABEL`, separados por vírgula) e campo `perfis` com `kind: "checkboxes"` (novo no kit: grupo de `Checkbox` do shadcn/ui; envia array).
- API (`users.server.ts`): `perfis: z.array(z.enum(PERFIS)).min(1, { error: "Informe ao menos um perfil" })` no schema de criação e de edição; gravação em transação (`userPerfil.deleteMany` + `createMany`); `include: { perfis: true }` e `serialize` devolvendo `perfis: Perfil[]`.
- Travas (`409`): remover `ADMINISTRADOR` do último Administrador ou excluí-lo → "O sistema precisa de ao menos um Administrador"; o Administrador logado remover o próprio perfil `ADMINISTRADOR` → "Não é possível remover o seu próprio perfil de Administrador". A trava existente "Não é possível excluir o próprio usuário logado" continua.

### Seed e migração dos usuários atuais

- `src/lib/auth/seed.ts` › `ensureAdminUser()`: cria o usuário inicial com `perfis: { create: { perfil: "ADMINISTRADOR" } }` (mantém `superuser: 1`).
- Migração de dados (no mesmo `migration.sql`, depois do `CREATE TABLE`), nesta ordem e idempotente (`INSERT OR IGNORE`):
  1. Usuários em grupos do legado (`groups_users` × `groups.name`): `ContratoCGCL` → `ADMINISTRADOR`; `Gestor` → `GESTOR_CONTRATO`; `PrestacaoConta` → `GESTOR_CONTRATO`; `Pagamentos` → `FINANCEIRO`.
  2. `users.superuser = 1` → `ADMINISTRADOR`.
  3. Usuário ainda sem perfil → `CONSULTA` (menor privilégio; o Administrador ajusta depois).
  4. Se não houver nenhum `ADMINISTRADOR` e existir usuário ativo, o de menor `id` com `inativo` nulo ou 0 recebe `ADMINISTRADOR`.
- O mapeamento do passo 1 também existe em código (`src/lib/auth/perfis-legado.ts` › `perfisDoLegado(nomesDosGrupos)`), para a carga da 025.

### Testes

- `tests/helpers/auth.ts` › `loginAs(username, perfis = ["ADMINISTRADOR"])`: os testes atuais continuam como Administrador.
- `tests/permissoes.test.ts` (novo), dirigido pela `MATRIZ`: para cada recurso servido pelo kit, cada perfil (usuário com um só perfil) e cada ação, chama o handler e espera `403` quando a ação não está na matriz e "não `403`" quando está; mais casos de dois perfis somados e de usuário sem perfil.
- Testes dos cenários de `specs/*/spec.md` por perfil (visão restrita, download, menu, travas de Administrador, migração).

## Risks / Trade-offs

- [Matriz errada tranca um perfil fora de uma tarefa] → matriz num arquivo só, teste dirigido por ela, e Administrador sempre pode tudo; ajuste é um PR de uma linha.
- [Testes atuais quebram com 403] → `loginAs` passa a criar Administrador por padrão.
- [Usuários atuais viram Consulta] → menor privilégio por decisão; o passo 4 garante ao menos um Administrador, que redistribui os perfis na tela de usuários.
- [Rota nova das 019–021 esquecida sem checagem] → `tests/permissoes.test.ts` tem um teste que percorre `src/app/api/**/route.ts` e falha se um handler exportado não passar por `requirePermission`, `crudHandlers` com `resource` ou estiver na lista de rotas só-sessão.
- [Esconder na interface não protege] → a interface é só conveniência; a checagem que vale é a do servidor (`security` › "Acesso negado responde 403").

## Open Questions

- **Escrita em contratos por todos os perfis** — o legado dava CRUD da árvore `contratos` a todos os grupos (`40_seed_acl.sql`). A matriz restringe: só Administrador exclui contrato; Fiscal e Financeiro só leem. Confirmar com o autor.
- **Escopo do Gestor de contrato (e do Fiscal)** — o legado não restringe por unidade gestora nem por contrato; o padrão adotado é ver todos. Restringir exigiria `users.departamentoId` (unidade gestora) ou ligar `users.pessoaId` ao CPF do gestor/fiscal do contrato. Confirmar.
- **`PrestacaoConta`** — tratado como capacidade do Gestor de contrato. Confirmar se deve ser perfil próprio (seria um sexto perfil, fora da decisão do autor).
- **Consulta exporta relatórios?** — proposto: vê na tela, não exporta. Confirmar.
- **Visão restrita** — os campos exatos de `visualizar_restrito` e `visualizar_resumo` não estão em `docs/legado/`; a projeção acima segue "dados do contrato sem anexos/edição". Conferir pelo MCP da RNC (`getModuleScreens` de `contratos_controller.php`).
- **Perfil padrão na migração** — proposto `CONSULTA` para quem não tem grupo nem `superuser`. Confirmar.

### Registradas na aplicação (14/11/2026)

- **Matriz confirmada** — o autor fechou a matriz em 14/11/2026 (`openspec/config.yaml`): só Administrador exclui contrato; Fiscal e Financeiro só leem contratos; Gestor de contrato vê todos os contratos. As três primeiras perguntas acima ficam respondidas por essa diretiva; a matriz foi implementada sem alteração.
- **`requirePermission` fora de `permissions.ts`** — o design põe `requirePermission` em `src/lib/auth/permissions.ts`, mas esse módulo é importado pelo menu (componente cliente) e `requirePermission` lê a sessão (cookies/Prisma). Ficou em `src/lib/auth/guard.ts` (com `guardPage` e `requireAnyPermission`); `permissions.ts` continua puro.
- **Visão restrita no kit** — `CrudConfig.restricted` (`{ resource, serialize }`): sem `ver` no recurso e com `ver` em `restricted.resource`, a lista e o detalhe saem pela projeção. Usado só em contratos (`contratos_resumo`, `contratoResumo`). A lista de aditivos (`GET /api/contratos/:id/aditivos`) também usa a projeção para quem não tem `contratos:ver`.
- **Aditivos na projeção** — além de `id`, `numeroContrato`, `dataInicio`, `dataTermino` e `valorTotal`, a projeção dos aditivos inclui `valorMensal` (a tabela de aditivos da página mostra a coluna, e `valorMensal` do próprio contrato já está na visão restrita).
- **Visão restrita sem Imprimir** — a impressão é complemento da 020 no recurso `contratos`; a visão restrita (Consulta) não mostra *Imprimir*, nem Número de fiscais, Localizado na Presidência e Data de inclusão (fora da lista da projeção). Confirmar se Consulta deve imprimir.
- **Página do contrato por permissão** — com `contratos:ver`: *Editar* só com `contratos:editar`, *Novo aditivo* só com `contratos:criar`, bloco Andamento só com `contrato_status:listar` e o formulário de andamento só com `contrato_status:criar`; listas de publicação e relatório fiscal só com `ver` nos respectivos recursos.
- **Fluxo da prestação de contas** — sem `prestacao_contas:criar` (Fiscal, Financeiro), as fases aparecem em leitura (última descrição e Atendido), sem *Gravar*.
- **Início (`/`)** — só sessão, como no design; o painel de vencimentos aparece só com `contratos:listar` (usuário sem perfil não vê contratos) e os atalhos *Novo contrato*, *Novo pagamento* e *Registrar penalidade* só com `criar` no recurso.
- **Índice de relatórios** — o cartão "Acerto de valor" só aparece com `acerto_valor:listar`; a dica de "Salvar como PDF" só com `relatorios:exportar`.
- **Última trava de Administrador** — `assertAdministrador` roda na transação da gravação e da exclusão (`users.server.ts`). Pela API ela só dispararia numa corrida (o logado deixar de ser Administrador no meio da requisição), porque só Administrador grava usuários e a trava do próprio perfil vem antes; o teste cobre a mensagem e a trava do próprio perfil.
- **Erro do perfil fora do catálogo** — vai para o campo `perfis` (não `perfis.0`), com "Perfil inválido"; lista vazia ou ausente → "Informe ao menos um perfil".
- **Download sem dono** — `GET /api/arquivos/:nome` passou a responder `404` para arquivo que nenhum registro referencia (cenário da spec); o teste antigo de download (001b, `tests/security.test.ts`) passou a criar o registro dono.
- **022 (tarefa 3.8)** — a 022 não criou tela nem rota nova além das referências já cobertas por `referencia` (`/api/pessoas_fisicas`, `/api/prestadores_servicos`); nenhuma linha nova na matriz. `GET /api/relatorios/contratos-por-gestor/gestores` (019) usa `relatorios:listar`.
- **Componente `Alert`** — não existia em `src/components/ui`; foi acrescentado com `npx shadcn add alert` (sem pacote novo).
