# Tasks

## 1. Modelo de dados e migração

- [ ] 1.1 `prisma/schema.prisma`: modelo `UserPerfil` (`user_perfis`: `id`, `userId` FK `onDelete: Cascade`, `perfil String`, `@@unique([userId, perfil])`) e `User.perfis`. Verificação: `npx prisma migrate dev --name 023_perfis_acesso` gera a migração sem erro; `npx prisma validate`.
- [ ] 1.2 Na mesma `migration.sql`: `CHECK (perfil IN ('ADMINISTRADOR','GESTOR_CONTRATO','FISCAL','FINANCEIRO','CONSULTA'))` e a migração de dados em quatro passos de `design.md` › "Seed e migração" (grupos do legado → `superuser = 1` → `CONSULTA` → garantia de um Administrador), com `INSERT OR IGNORE`. Verificação: `tests/perfis-migracao.test.ts` (novo) roda o SQL de dados sobre um banco de teste com os cenários *Usuário superuser*, *Grupo do legado* e *Rodar duas vezes*.
- [ ] 1.3 `src/lib/auth/perfis-legado.ts` › `perfisDoLegado(nomes)` com o mesmo mapeamento (`ContratoCGCL` → `ADMINISTRADOR`; `Gestor`, `PrestacaoConta` → `GESTOR_CONTRATO`; `Pagamentos` → `FINANCEIRO`), para a 025. Verificação: teste unitário com os quatro grupos e um nome desconhecido (ignorado).

## 2. Catálogo, matriz e sessão

- [ ] 2.1 `src/lib/auth/permissions.ts`: `PERFIS`, `PERFIL_LABEL`, `ACOES`, `MATRIZ` (exatamente a tabela de `design.md` › "Catálogo e matriz"), `can`, `permissoesDe`, `ForbiddenError`, `requirePermission`. Verificação: teste unitário de `can` com dois perfis (união) e com lista vazia (nega tudo); cenário *Usuário com dois perfis*.
- [ ] 2.2 `src/lib/auth/session.ts`: `SessionUser.perfis`, lidos em `getSessionUser()` na mesma consulta da sessão. Verificação: cenário *Perfil retirado vale na próxima requisição* em `tests/security.test.ts`.
- [ ] 2.3 `src/app/api/auth/me/route.ts`: devolve `perfis` e `permissoes`. Verificação: cenário *Consultar as próprias permissões*.
- [ ] 2.4 `tests/helpers/auth.ts` › `loginAs(username, perfis = ["ADMINISTRADOR"])`. Verificação: `npm test` inteiro verde antes de ligar a checagem (os testes atuais passam como Administrador).

## 3. Aplicação no servidor

- [ ] 3.1 `src/lib/crud/server.ts`: `CrudConfig.resource` obrigatório; checagem por handler (`listar`, `ver`, `criar`, `editar`, `excluir`) e `anexar` quando o corpo traz `Blob` não vazio, antes de qualquer gravação de arquivo; `ForbiddenError` → `403` em `handleError`. Verificação: cenários *Consulta tenta criar contrato*, *Sem sessão continua 401*, *Perfil forjado no corpo* e *Financeiro tenta anexar publicação* (conta `UPLOAD_DIR`).
- [ ] 3.2 Declarar `resource` em todos os `crudHandlers` de `src/lib/entities/*.server.ts` conforme a coluna "Recurso" da matriz (`cadastros` para departamentos, tipo_contratos, modalidades, situacao_contratuals, fases e status). Verificação: `npx tsc --noEmit` (campo obrigatório) e `tests/permissoes.test.ts`.
- [ ] 3.3 Rotas fora do kit: `listAditivos`/`createAditivo` (`contratos`), `removeUser` (`users:excluir`), `trocarSenha` (só sessão), `referenceListHandler` (`referencia:listar`; `groups`/`groups_users` → `users:listar`). Verificação: cenários *Financeiro não cria aditivo*, *Dropdown para todos*, *Consulta troca a própria senha*, *Gestor tenta abrir usuários*.
- [ ] 3.4 `src/app/api/arquivos/[nome]/route.ts`: `findAttachmentOwner(nome)` e `ver` no recurso dono; sem dono → `404`. Verificação: cenários *Consulta tenta baixar o anexo do contrato* e *Fiscal baixa relatório de fiscalização*.
- [ ] 3.5 Projeção restrita `contratoResumo(row)` em `src/lib/entities/contratos.server.ts`, aplicada em `list`, `get` e `getContratoDetalhe` quando o usuário não tem `contratos:ver`. Verificação: cenário *API do contrato para Consulta*.
- [ ] 3.6 Rotas da 019 (relatórios: tela → `relatorios:listar`; PDF/Excel → `relatorios:exportar`; acerto de valor → `acerto_valor:listar`/`editar`), da 020 (fluxo → `contrato_status`; complementos → `contratos`) e da 021 (painel e fluxo → `prestacao_contas`) com `requirePermission`. Verificação: cenários *Consulta não exporta*, *Gestor não acerta valor*, *Gestor grava fase da prestação*, *Fiscal só consulta a prestação*.
- [ ] 3.7 Teste de cobertura em `tests/permissoes.test.ts`: percorre `src/app/api/**/route.ts` e falha se algum handler exportado não usar `crudHandlers` com `resource`, `requirePermission` ou não estiver na lista só-sessão (`/api/auth/*`, `/api/conta/senha`). Verificação: o próprio teste verde.
- [ ] 3.8 Se a 022 tiver criado telas ou rotas, acrescentar o recurso à `MATRIZ` (com a mesma lógica de perfis) e a linha correspondente em `design.md`. Verificação: teste 3.7 verde.

## 4. Interface

- [ ] 4.1 `src/lib/navigation.ts`: `NavItem.resource`; `navByGroup(user)` filtra por `listar` e some com grupo vazio; itens das 019 e 021 com `resource`. `src/app/(app)/layout.tsx` e `src/components/app-sidebar.tsx` recebem o usuário. Verificação: cenário *Menu da Consulta* em `tests/navigation.test.ts`.
- [ ] 4.2 `src/lib/auth/guard.ts` › `guardPage(recurso, acao)` e componente `SemPermissao` (`Alert` do shadcn/ui); chamada em todos os `page.tsx` de `src/app/(app)/**` (lista → `listar`, `new` → `criar`, `[id]/edit` → `editar` ou `ver` em leitura, `contratos/[id]` → `ver` ou `contratos_resumo:ver`, `contratos/[id]/aditivos/new` → `contratos:criar`), inclusive `src/app/(app)/[entidade]/page.tsx`. Verificação: cenários *Abrir URL de criação sem permissão* e *Lista sem perfil Administrador*; checagem manual com um usuário Consulta em cada item do menu.
- [ ] 4.3 Kit de telas: `EntityList.canCreate` e `EntityForm.canDelete` calculados por `can` nas páginas; `EntityForm.readOnly` (novo) e campos `kind: "file"` escondidos sem `anexar`. Verificação: cenário *Lista sem permissão de criar* (teste de componente ou checagem manual registrada no PR).
- [ ] 4.4 `/contratos/[id]`: visão restrita (sem blocos de anexos, sem *Editar*/*Novo aditivo*) para quem só tem `contratos_resumo:ver`. Verificação: cenário *Consulta abre um contrato* (teste do componente de servidor com usuário Consulta).
- [ ] 4.5 Botões *Exportar*/*Imprimir* das telas da 019 só com `relatorios:exportar`; tela de acerto de valor só com `acerto_valor:listar`. Verificação: cenário *Consulta não exporta* (parte da interface), checagem manual.

## 5. Usuários e perfis

- [ ] 5.1 `FieldKind` `"checkboxes"` no kit (`src/components/crud/types.ts`, `entity-form.tsx`, com `Checkbox` do shadcn/ui; envia array) e o campo `perfis` em `src/lib/entities/users.ts` (opções de `PERFIL_LABEL`), coluna "Perfis". Verificação: cenário *Abrir a lista* (coluna Perfis) e checagem manual do formulário.
- [ ] 5.2 `users.server.ts`: `perfis: z.array(z.enum(PERFIS)).min(1)` nos schemas de criação e edição; gravação em transação; `include` + `serialize` com `perfis`; `resource: "users"`. Verificação: cenários *Salvar um usuário válido*, *Sem perfil*, *Acrescentar um perfil*, *Perfil fora do catálogo* em `tests/users.test.ts`.
- [ ] 5.3 Travas `409`: próprio perfil Administrador e "ao menos um Administrador" na transação de gravação e de exclusão. Verificação: cenários *Remover o próprio perfil*, *Remover Administrador de outro usuário* e *Excluir o próprio usuário*.
- [ ] 5.4 `src/lib/auth/seed.ts` › `ensureAdminUser()` cria o usuário com perfil `ADMINISTRADOR`. Verificação: cenário *Primeiro login*; `node scripts/smoke.mjs` contra `docker compose up --build` continua com todas as verificações ok.

## 6. Testes por perfil e verificação

- [ ] 6.1 `tests/permissoes.test.ts` dirigido pela `MATRIZ`: para cada recurso do kit, cada perfil isolado e cada ação, `403` quando a ação não está na matriz e diferente de `403` quando está; usuário sem perfil → `403` em tudo (cenário *Usuário sem perfil abre contratos*). Verificação: o teste verde.
- [ ] 6.2 Um teste por `#### Scenario:` de `specs/perfis-acesso/spec.md`, `specs/users/spec.md` e `specs/security/spec.md`, todos verdes (`npm test`), incluindo *Gestor não exclui contrato*, *Gestor anexa projeto básico*, *Fiscal registra andamento*, *Fiscal não designa fiscal*, *Consulta não vê históricos*, *Fiscal envia relatório de fiscalização*, *Financeiro registra pagamento*, *Gestor não altera pagamento*, *Gestor não cria departamento*, *Gestor edita contrato de outra unidade*.
- [ ] 6.3 `npx tsc --noEmit`, `npm run lint` e `npm run build` sem erros.
- [ ] 6.4 `OPENSPEC_TELEMETRY=0 npx -y @fission-ai/openspec@latest validate 023-perfis-acesso --strict` passa.
