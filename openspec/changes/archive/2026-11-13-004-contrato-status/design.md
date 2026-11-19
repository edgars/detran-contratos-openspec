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

- **`contratoId` e `statusId` viram lookups obrigatórios** — são NOT NULL no modelo e ausentes da tela da spec. `contratoId`: lookup de `/api/contratos` exibindo `numeroContrato`; `statusId`: lookup de `/api/status` exibindo `nome`. Ficam depois de `descricao` e `atendido` para manter a ordem da spec. A API confere que o contrato e o status existem (400 por campo), pois o modelo não declara FK.
- **`statusId` obrigatório = `RK-a7017eb6c42d` / `RK-067d06861847`** (change 011-status) — o campo vem de `src/lib/entities/status.rules.ts` (`statusIdField`).
- **`descricao`** usa `contratoStatusFields.descricao` (`RK-f0ce91a53de9`: aspas duplas → simples antes de gravar).
- **`atendido` é Int** — toggle com `toggleValues [1,0]`; o schema aceita só 0/1 (`z.coerce.number`). Na lista aparece como Sim/Não.
- **Campos do servidor** — `dataInclusao` = data do servidor na criação; `usuarioId` = usuário da sessão (`withAuthor(..., "usuarioId")`), só na criação. Não são campos do formulário; enviá-los gera 400 (schema estrito). `aditivoId` (nullable, sem origem na tela) não é exposto.
- **Busca** — `q` procura em `descricao`; "sim"/"1" e "não"/"0" filtram `atendido` (coluna Int não aceita `contains`). Filtro opcional `contratoId` na lista.
- **PUT substitui o registro** — campo opcional apagado no formulário grava `null`.


## Open Questions

- A conferência das regras pelo MCP da RNC (`getRule`) não foi feita nesta execução (MCP não conectado); tarefa de verificação marcada só pelo `openspec validate --strict`.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.
