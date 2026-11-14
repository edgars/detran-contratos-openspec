# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| nome | Nome | input | — | — | não | sim |
| fluxo | Fluxo | select | — | — | não | sim |
| periodo | Período | select | — | — | não | sim |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **`RK-a7017eb6c42d` e `RK-067d06861847` (status_id is required)** — a tabela `status` não tem coluna `status_id`; as duas regras (cópias do `app/` e do plugin) valem para quem referencia um Status: `contrato_status.status_id`. Ponto único: `statusIdField` em `src/lib/entities/status.rules.ts`, usado pelo schema de `contrato_status` (004) → 400 "Status é obrigatório". Consequência aplicada na exclusão: Status em uso por `contrato_status` não pode ser excluído (409), porque o modelo não declara FK que impeça o órfão.
- **`fluxo` e `periodo` (select sem opções rastreadas)** — viram campos de texto. `fluxo` é `String?` e aceita texto livre; `periodo` é `Int?` e aceita só número inteiro (400 "Período deve ser um número inteiro"). Nenhuma opção foi inventada.
- **Busca** — `q` procura em `nome` e `fluxo` (`contains`) e, se numérico, em `periodo` (igualdade), pois `periodo` é Int.
- **PUT substitui o registro** — campo apagado no formulário grava `null`.

- **Onde cada regra vale** — `RK-a7017eb6c42d`: a definir — ler a regra antes de escolher a camada
- **Onde cada regra vale** — `RK-067d06861847`: a definir — ler a regra antes de escolher a camada

## Open Questions

- `TODO(review)`: confirmar no legado (`getRule`/`getSourceFile`) que as duas regras são a validação de `status_id` do modelo ContratoStatus e as opções reais dos selects `fluxo` e `periodo`.
- A conferência das regras pelo MCP da RNC (`getRule`) não foi feita nesta execução (MCP não conectado); tarefa de verificação marcada só pelo `openspec validate --strict`.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.
