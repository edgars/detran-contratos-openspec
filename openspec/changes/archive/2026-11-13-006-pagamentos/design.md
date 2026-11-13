# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| numeroProcesso | Número Processo | input | — | — | sim | sim |
| ano | Ano | input | — | — | não | sim |
| notaFiscal | Nota Fiscal | input | — | — | não | sim |
| empenho | Empenho | input | — | — | não | sim |
| notaLiquidacao | Nota Liquidação | input | — | — | não | sim |
| ordemBancaria | Ordem Bancária | input | — | — | não | não |
| valor | Valor | input | — | — | não | não |
| valorGlosa | Valor Glosa | input | — | — | não | não |
| mes | Mês | select | — | — | não | não |
| glosa | Glosa | select | — | — | não | não |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **Validação dupla** — campos obrigatórios validados no formulário e na API; a API é a última palavra.
- **contratoId e competencia no formulário** — as colunas `contratoId` e `competencia` são NOT NULL no modelo `Pagamento` e não constam do formulário da spec. Foram acrescentadas no início do formulário: `contratoId` como lookup obrigatório (`/api/contratos`, rótulo `numeroContrato`) e `competencia` como data obrigatória `dd/MM/yyyy` (RK-774f44ed6df9, campo `pagamentoFields.competencia`). A ordem relativa dos 10 campos da spec foi mantida.
- **Dinheiro** — `valor` e `valorGlosa` usam o componente `money` (`1.234,56`) e são convertidos para `Prisma.Decimal` só com `toDecimal` no `beforeSave` (diretiva do autor; nunca Number/parseFloat). Texto que `toDecimal` não lê gera `400` no campo ("Valor inválido").
- **Colunas da lista** — a lista segue a spec (`numeroProcesso`, `ano`, `notaFiscal`, `empenho`, `notaLiquidacao`); `valor`/`valorGlosa` não são colunas (design: "Coluna da lista: não"). Se forem acrescentadas no futuro, usam `format: "currency"`.
- **Opções de `mes`** (sem opções rastreadas no legado) — `"01"`..`"12"` com rótulos Janeiro..Dezembro; a API recusa outro valor.
- **Opções de `glosa`** (sem opções rastreadas no legado) — `"S"` (Sim) / `"N"` (Não), convenção dos campos S/N do projeto; a API recusa outro valor.
- **Limpar campo opcional na edição** — campo opcional enviado vazio é gravado como `null` (o `optionalString` do kit converte vazio em `undefined`, que o Prisma ignoraria no update).

## Open Questions

- A conferência das regras (RK-774f44ed6df9) com `getRule` pelo MCP da RNC não foi feita nesta execução (MCP não conectado).
- Opções reais de `mes` e `glosa` no legado: confirmar pelo MCP (`getSourceFile`).
- O lookup `/api/contratos` depende da change 017-contratos; até lá o select de contrato fica vazio.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.
