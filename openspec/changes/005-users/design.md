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

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
