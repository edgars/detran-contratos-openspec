# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| nome | Nome | input | — | — | não | sim |
| gerenciamento | Gerenciamento | toggle | — | — | sim | sim |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **Validação dupla** — campos obrigatórios validados no formulário e na API; a API é a última palavra.
- **`nome` obrigatório** — o design marca `nome` como não obrigatório, mas a regra transversal `RK-82de63b47e64` ("Por favor,Preencher o campo NOME !") da fundação vale para `tipo_contrato.nome`; prevalece a regra (usa `tipoContratoFields.nome`).
- **`gerenciamento`** — toggle `S`/`N` (coluna String); a API exige `S` ou `N` (`tipoContratoFields.gerenciamento`, RK-2509b78bd0e0 RK-4564e4e322b6). O formulário começa em `N`.
- **`indicativoMetaRisco`** — coluna NOT NULL fora do formulário; usa o default `"N"` do banco e não é aceita pela API (schema estrito).
- **Busca** — `q` procura em `nome` e `gerenciamento`; há também o filtro `?gerenciamento=S|N`.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.

## Open Questions

- **Conferência pelo MCP da RNC** — a tarefa 4.2 pede `getRule` para cada `RK-…`; a conferência pelo MCP não foi feita nesta execução (MCP não conectado). As chaves foram aplicadas como estão na fundação (`src/lib/rules`).
