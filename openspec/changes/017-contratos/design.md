# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| busca | Busca | input | — | — | não | sim |
| tipoContratoId | Tipo Contrato ID | input | — | — | sim | sim |
| modalidadeId | Modalidade ID | input | — | — | não | sim |
| campo | Campo | select | — | — | não | sim |
| ordenar | Ordenar | select | — | — | não | sim |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **`tipoContratoId` é um lookup de TipoContrato** — select carregado de `/api/tipo_contratos`; grava o id do registro escolhido.
- **`modalidadeId` é um lookup de Modalidades** — select carregado de `/api/modalidades`; grava o id do registro escolhido.
- **`situacaoContratualId` é um lookup de SituacaoContratual** — select carregado de `/api/situacao_contratual`; grava o id do registro escolhido.
- **`prestadorServicoId` é um lookup de PrestadoresServicos** — select carregado de `/api/prestadores_servicos`; grava o id do registro escolhido.
- **`situacaoContratual` é um lookup de SituacaoContratual** — select carregado de `/api/situacao_contratual`; grava o id do registro escolhido.
- **Validação dupla** — campos obrigatórios validados no formulário e na API; a API é a última palavra.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.
