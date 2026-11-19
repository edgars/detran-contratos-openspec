# Design

## Context

O app é Next.js (App Router) com Prisma e SQLite, conforme `001-project-foundation`.
Esta change é a primeira depois da fundação; as changes de entidade herdam tudo daqui.

## Goals / Non-Goals

**Goals:**
- Nenhuma rota acessível sem sessão, exceto `/login`.
- Um ponto único para validar corpo de requisição, upload e dinheiro.

**Non-Goals:**
- SSO, OAuth ou provedores externos.
- Autorização por grupo.

## Decisions

- **Sessão** — Auth.js (NextAuth) com provider de credenciais e estratégia de sessão no banco, ou sessão própria em tabela `sessions`. Cookie `httpOnly`, `Secure` em produção, `SameSite=Lax`. O id de sessão nunca é lido de query string, corpo ou header customizado.
- **Proteção de rotas** — `middleware.ts` redireciona páginas sem sessão para `/login` e responde `401` em `/api/*` sem sessão. Lista de rotas públicas: só `/login`, `/api/auth/*` e assets estáticos.
- **Hash de senha** — `argon2id` (pacote `@node-rs/argon2`) ou `bcrypt` com custo mínimo 12. Coluna `users.passwordHash`.
- **Validação por schema** — um schema `zod` por entidade, com `.strict()`: campo não declarado gera `400`. O handler grava só o objeto validado pelo schema, nunca o corpo bruto.
- **Uploads** — um utilitário `savePdf()`: confere a assinatura `%PDF-` nos primeiros bytes (o tipo informado pelo navegador não basta), aplica o limite `UPLOAD_MAX_MB` (padrão 10), grava em `UPLOAD_DIR` fora de `public/` com nome gerado e serve o arquivo por rota autenticada.
- **Dinheiro** — `Decimal` no Prisma; o formulário aceita `1.234,56` e converte sem passar por `number`; exibição com o formatador `R$` da fundação.
- **Autoria** — campos `userId` de `prestacao_contas` e `penalidades` são preenchidos com o usuário da sessão no servidor e não aparecem no formulário.
- **Consultas** — só a API do Prisma ou `$queryRaw` com template tag; `$queryRawUnsafe` e concatenação de SQL são proibidos (regra de lint).

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `AUTH_SECRET` | Assinatura da sessão |
| `UPLOAD_DIR` | Pasta dos anexos, fora de `public/` |
| `UPLOAD_MAX_MB` | Limite de tamanho do upload (padrão 10) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Usuário inicial criado pelo seed, só se `users` estiver vazia |

## Risks / Trade-offs

- [Usuários do legado sem senha migrável] → seed cria só o admin inicial; a migração de usuários é decisão de produto.
- [Telas que dependem de autoria] → o formulário não pede `userId`; testes conferem que o valor vem da sessão.

## Open Questions

- **Permissões por grupo** — o legado tem `groups`, `groups_users` e `aco_id` (sistema). Definir se o app novo tem perfis (por exemplo, administrador, gestor, fiscal, financeiro) antes de restringir telas.
- **Algoritmo de hash do legado** — confirmar pelo MCP da RNC (`getSourceFile` em `users_controller.php`) se as senhas antigas podem ser migradas.
