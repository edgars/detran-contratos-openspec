# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| descricao | Descrição | input | — | — | não | sim |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **Duas rotas de API** — `/api/situacao_contratuals` (desta change) e `/api/situacao_contratual` (nome da tabela, usado pelo lookup de `017-contratos`) exportam os mesmos handlers de `src/lib/entities/situacao_contratuals.server.ts`.
- **`descricao` opcional** — nenhum campo obrigatório; texto vazio é gravado como `null`.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.

## Open Questions

- **Conferência pelo MCP da RNC** — a tarefa 4.2 pede `getRule` para cada `RK-…`; a conferência pelo MCP não foi feita nesta execução (MCP não conectado). As chaves foram aplicadas como estão na fundação (`src/lib/rules`).
