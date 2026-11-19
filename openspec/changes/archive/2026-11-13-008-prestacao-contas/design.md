# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| descricao | Descrição | input | — | — | não | sim |
| atendido | Atendido | toggle | — | — | não | sim |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **Colunas NOT NULL fora do formulário da spec** — `faseId` e `contratoId` (NOT NULL em `prestacao_contas`) viraram lookups obrigatórios depois de `descricao` e `atendido`: Fase (`/api/fases`, rótulo `nome`) e Contrato (`/api/contratos`, rótulo `numeroContrato`). O `beforeSave` confere que a fase e o contrato existem (o modelo não tem FK) e responde `400` no campo se não existirem.
- **Autoria** — `userId` é sempre o usuário da sessão, via `withAuthor` no `beforeSave`, na criação e na edição (quem grava por último). Não é campo do formulário; `userId` enviado pelo cliente é descartado no `prepare` (não gera `400`), conforme `001b-security-baseline` › "Autoria forjada".
- **dataInclusao** — preenchida pelo servidor (`new Date()`) só na criação; valor enviado pelo cliente é descartado.
- **atendido** — coluna String: toggle grava `"S"`/`"N"`; o schema aceita só esses valores (ou vazio). Na lista aparece como Sim/Não.
- **Lista** — só as colunas da spec (`descricao`, `atendido`); busca `q` em `descricao` e `atendido`; ordem por `id` decrescente.


## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.

## Open Questions

- A conferência pelo MCP da RNC (`getRule`) não foi feita nesta execução (a change não cita `RK-…`).
- Na edição, `userId` passa a ser o do último usuário que gravou; confirmar se o legado mantinha o autor original.
