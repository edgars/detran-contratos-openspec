# Design

## Context

Campos do cadastro, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| username | Usuário | input | — | — | sim (`RK-d76edbb42dbe`, fundação) | sim |
| password | Senha inicial | input password | — | só em `/users/new`; vira `passwordHash` | sim na criação (`RK-3e9d7e57ae65`, fundação) | não |
| passwordconfirm | Confirmar senha | input password | — | só em `/users/new` | sim na criação | não |

Tela `/conta/senha` (troca da própria senha):

| Campo | Rótulo | Componente | Obrigatório |
|---|---|---|---|
| passwordold | Senha atual | input password | sim |
| passwordnew | Nova senha | input password | sim |
| passwordconfirm | Confirmar nova senha | input password | sim |

`passwordold`, `passwordnew` e `passwordconfirm` são campos de formulário, nunca colunas.

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro e a troca de senha do legado sem expor senhas.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar usuários do legado.
- Recuperação de senha por e-mail.

## Decisions

- **Troca de senha** — `RK-9187b7b464f8`/`RK-304882e7bdc8` (senha atual confere com o hash) e `RK-dcfcd941a4d6`/`RK-96cbe7d6e198` (nova senha igual à confirmação) usam a validação compartilhada da fundação; o ponto de uso é a action de `/conta/senha`.
- **Edição de usuário** — `/users/[id]/edit` altera só `username`; a senha de outro usuário não é editada por esta tela.
- **Validação dupla** — campos obrigatórios validados no formulário e na API; a API é a última palavra.
- **Criação** (implementação) — `usersCreateSchema` (`username`, `password`, `passwordconfirm`, estrito) em `src/lib/entities/users.server.ts`; o `beforeSave` confere `password === passwordconfirm` (erro no campo `passwordconfirm`: "A senha e a confirmação não conferem!" — o legado não tinha mensagem própria para a criação, então não se reusou "A nova senha não confere!", que é da troca de senha) e grava só `{ username, passwordHash: hashPassword(password) }`. `username` duplicado vira `400` no campo (a coluna é `@unique`; o kit devolveria `500`).
- **Edição** (implementação) — `usersUpdateSchema` só com `username`; qualquer campo de senha no `PUT` gera `400` (schema estrito). Os campos de senha do formulário são `createOnly`.
- **Respostas** — toda resposta de `/api/users` passa por `publicUser` (`serialize`); `/api/conta/senha` devolve só `{ ok: true }` ou `{ errors }`.
- **Excluir o próprio usuário** — bloqueado: `DELETE /api/users/:id` com o id do usuário da sessão responde `409` "Não é possível excluir o próprio usuário logado" (evita derrubar a própria sessão e ficar sem administrador). Exclusão de usuário referenciado (ex.: históricos) responde `409` pelo kit.
- **Troca de senha** (implementação) — `POST /api/conta/senha` (`src/app/api/conta/senha/route.ts`) sempre sobre o usuário da sessão; corpo estrito com os três campos obrigatórios; usa `validatePasswordChange` de `src/lib/rules` com `verifyPassword`. As outras sessões do usuário não são encerradas na troca (não pedido pela spec).
- **Tela `/conta/senha`** — feita com o `EntityForm` do kit (POST para `/api/conta/senha`, sem excluir), ligada ao item "Trocar senha" do menu do usuário já existente.

## Open Questions

- A conferência das chaves `RK-d76edbb42dbe`, `RK-3e9d7e57ae65`, `RK-9187b7b464f8`, `RK-304882e7bdc8`, `RK-dcfcd941a4d6` e `RK-96cbe7d6e198` pelo MCP da RNC (`getRule`) não foi feita nesta execução.
- Encerrar as demais sessões do usuário ao trocar a senha? Hoje não encerra.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
