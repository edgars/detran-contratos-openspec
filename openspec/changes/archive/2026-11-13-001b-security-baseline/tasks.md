# Tasks

## 1. Autenticação e sessão

- [x] 1.1 Coluna `users.passwordHash` (migração) e utilitário de hash `argon2id`/`bcrypt` custo 12; teste unitário de hash e verificação.
- [x] 1.2 Tela `/login` (shadcn/ui `form`, `input`, `button`) e rota de login; teste: senha errada recusa com mensagem genérica.
- [x] 1.3 Sessão em cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção, renovada no login e apagada no logout; teste: o id muda a cada login e `?sessionId=` é ignorado. _(Testado em `tests/security.test.ts`: id novo a cada login, `?sessionId=`/header ignorados, logout apaga. Atributos `httpOnly`/`SameSite=Lax`/`Secure` conferidos só por leitura de `src/lib/auth/session.ts:28-34`: o mock de `next/headers` descarta as opções do cookie.)_
- [x] 1.4 `middleware.ts`: páginas sem sessão vão para `/login`, `/api/*` sem sessão responde `401`; teste de integração cobrindo uma página e uma API.
- [x] 1.5 Seed do usuário inicial a partir de `ADMIN_USERNAME`/`ADMIN_PASSWORD`, só com `users` vazia; teste do seed. _(Teste de `ensureAdminUser` com `users` não vazia e vazia simulada por spy em `prisma.user.count`.)_

## 2. Gravação segura

- [x] 2.1 Helper de rota que valida o corpo com schema `zod` `.strict()` e grava só o objeto validado; teste: campo extra gera `400`. _(Teste com o kit `crudHandlers` sobre `prisma.contratoStatus` e em `POST /api/users`.)_
- [x] 2.2 Serializador de `users` que remove `password*` e `passwordHash` de toda resposta; teste em `GET /api/users` e `GET /api/users/:id`.
- [x] 2.3 Autoria: helper que injeta `userId` da sessão; teste com `userId` forjado no corpo.
- [x] 2.4 Regra de lint proibindo `$queryRawUnsafe`/`$executeRawUnsafe`; `npm run lint` falha num arquivo de teste com uso proibido. _(Verificado pela API do ESLint (`lintText` com a config do projeto) em `tests/security.test.ts`, não por `npm run lint`.)_

## 3. Uploads

- [x] 3.1 Utilitário `savePdf()` (assinatura `%PDF-`, limite `UPLOAD_MAX_MB`, `UPLOAD_DIR` fora de `public/`, nome gerado); testes: PDF válido, imagem renomeada, arquivo acima do limite.
- [x] 3.2 Rota autenticada de download de anexo; teste: sem sessão responde `401`.

## 4. Dinheiro

- [x] 4.1 Campo de formulário de moeda que aceita `1.234,56` e envia string decimal; conversão para `Prisma.Decimal` no servidor; teste `0,10 + 0,20 = 0,30`.

## 5. Ambiente e verificação

- [x] 5.1 `.env.example` com `AUTH_SECRET`, `UPLOAD_DIR`, `UPLOAD_MAX_MB`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`; conferência manual de que nenhum valor real está versionado. _(`.env.example` conferido: segredos vazios; `ADMIN_USERNAME="admin"` não é segredo.)_
- [x] 5.2 Um teste por `#### Scenario:` de `specs/security/spec.md`, todos verdes; `openspec validate 001b-security-baseline --strict` passa.
