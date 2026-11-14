# Perfis de acesso

Depende de: 024-kit-robustez (ganchos do kit: `ctx.user` no `listWhere`, `UploadSession`, `beforeDelete`), 019 (relatórios), 020 (fluxo e complementos do contrato), 021 (prestação de contas) e 022 (ordem numérica). A matriz cobre as telas e rotas de 019, 020 e 021; se a 022 criar tela ou rota, ela entra na matriz na aplicação desta change (tarefa 3.8). Ordem de aplicação: 024 antes de 020–023.

## Why

O app novo só exige sessão: qualquer usuário logado cria, edita e exclui tudo, inclusive usuários. O legado controlava o acesso por grupos (ACL CakePHP, `docs/legado/perfis-acesso.md`), e o autor decidiu em 13/11/2026 os perfis do app novo: **Administrador, Gestor de contrato, Fiscal, Financeiro e Consulta**, com mais de um perfil por usuário (`openspec/config.yaml`). A Open Question "Permissões por grupo" de `001b-security-baseline/design.md` e a associação usuário–grupo deixada fora de escopo na 001 (`docs/legado/rk-conferencia.md`) são resolvidas aqui.

## What Changes

- Tabela `user_perfis` (usuário × perfil) e catálogo fixo dos cinco perfis.
- Matriz de permissões por recurso e ação (listar, ver, criar, editar, excluir, anexar, exportar) para todas as telas e APIs existentes e as das changes 019, 020 e 021, em `src/lib/auth/permissions.ts`.
- Checagem no servidor: o kit de CRUD, as rotas próprias, os downloads de anexo e as páginas da área logada respondem `403` (API) ou mostram "Você não tem permissão para acessar esta página." sem permissão.
- Interface: o menu mostra só o que o usuário pode listar; *Novo*, *Editar*, *Excluir*, campos de anexo e *Exportar* aparecem só com a permissão.
- Visão restrita do contrato para Consulta (sem anexos nem edição), como `visualizar_restrito` do legado.
- Tela de usuários (só Administrador) com coluna e campo de perfis; trava do último Administrador.
- Usuário inicial do seed com perfil Administrador; migração dos usuários atuais (grupos do legado e `superuser` → perfis; demais → Consulta; ao menos um Administrador).
- Testes por perfil dirigidos pela matriz.

## Capabilities

### New Capabilities

- `perfis-acesso`: catálogo de perfis, matriz de permissões por recurso e ação, escopo dos perfis, visão restrita do contrato, interface conforme permissão, seed e migração de perfis.

### Modified Capabilities

- `users`: lista, criação, edição e exclusão de usuários passam a tratar perfis e ficam restritas ao Administrador.
- `security`: acrescenta a autorização por perfil no servidor (`403`) e o download de anexo conforme a permissão do registro dono.

## Impact

- Banco: migração `*_023_perfis_acesso` (tabela `user_perfis` com `CHECK` do perfil e migração de dados dos usuários atuais).
- Código: `src/lib/auth/{permissions,guard,perfis-legado,session,seed}.ts`, `src/lib/crud/server.ts` (`resource`), `src/lib/reference/route.ts`, `src/lib/navigation.ts`, `src/components/app-sidebar.tsx`, `src/components/crud/{entity-list,entity-form,types}.tsx`, `src/lib/entities/*.server.ts` (`resource` em cada `crudHandlers`), `src/lib/entities/users*.ts`, `src/lib/entities/contratos.server.ts` (projeção restrita), `src/app/api/arquivos/[nome]/route.ts`, `src/app/api/auth/me/route.ts`, todos os `page.tsx` de `src/app/(app)/**`, e as rotas e páginas criadas por 019, 020 e 021.
- Testes: `tests/permissoes.test.ts` (novo), `tests/helpers/auth.ts` (`loginAs` com perfis; padrão Administrador), ajustes em `tests/users.test.ts`, `tests/security.test.ts`, `tests/contratos.test.ts`, `tests/navigation.test.ts`.
- `scripts/smoke.mjs`: o usuário do smoke é o do seed (Administrador); nenhuma mudança esperada além de conferir `GET /api/auth/me` com `perfis`.

## Fora de escopo

- Restrição por unidade gestora ou por contrato do Gestor de contrato, do Fiscal ou do Financeiro: o legado não restringe; fica em Open Questions do `design.md`.
- Editor de permissões na interface; criação de perfis além dos cinco decididos.
- Carga de usuários e grupos do legado (`025`), que usa o mapeamento `perfisDoLegado` definido aqui.
- Inativar usuário pela tela (`users.inativo` existe, sem tela) e encerrar sessões ao mudar perfis (a permissão já é relida a cada requisição).
- Trilha de auditoria de quem mudou perfis.
