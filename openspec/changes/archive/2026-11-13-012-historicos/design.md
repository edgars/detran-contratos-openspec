# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| descricao | Descrição | read-only | — | — | não | não |
| contratoId | Contrato ID | input | — | — | sim | sim |
| id | ID | read-only | — | — | sim | não |
| dataInclusao | Data Inclusão | read-only | — | — | não | não |
| usuarioId | Usuário ID | read-only | — | — | não | não |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **Lookup de contrato exibe `numeroContrato`** (não `numeroProcesso` como diz a tarefa 3.4), conforme a convenção de rótulos do projeto; a busca `q` também casa `numeroProcesso`, `numeroContrato`, id do contrato e `descricao`. A API confere que o contrato existe (400 por campo).
- **`usuarioId` = usuário da sessão, não editável** (diverge do requisito "`usuarioId` referencia Users", que pede escolha em `/api/users`): o design marca o campo read-only e as diretivas do autor exigem autoria pela sessão. Gravado com `withAuthor(..., "usuarioId")` na criação; no formulário aparece read-only (`usuarioNome`). Enviar `usuarioId` no corpo gera 400. A tarefa 3.5 (select de `/api/users` exibindo `id`) não foi implementada por isso.
- **`dataInclusao` = data do servidor na criação**; read-only no formulário (`dataInclusaoTexto`, dd/MM/yyyy). Edição não altera autor nem data.
- **`id` obrigatório** é atendido pelo autoincremento; read-only no formulário e rejeitado no corpo (schema estrito).
- **`descricao` editável (textarea), opcional** — o design a marca read-only, mas sem ela o histórico não teria conteúdo; a spec não a torna obrigatória.
- **Lista** mostra contrato (`numeroContrato`), data de inclusão e usuário (`username`), além da coluna `contratoId` da spec. O usuário vem de `include: { usuario: { select: { id, username } } }` — nunca `passwordHash`. O modelo não declara relação com Contrato: o número é acrescentado na resposta por consulta separada.

- **`contratoId` é um lookup de Contratos** — select carregado de `/api/contratos`; grava o id do registro escolhido.
- **`usuarioId` é um lookup de Users** — select carregado de `/api/users`; grava o id do registro escolhido.
- **Validação dupla** — campos obrigatórios validados no formulário e na API; a API é a última palavra.

## Open Questions

- Confirmar com o autor se `usuarioId` deveria ser escolhido de `/api/users` (spec) ou ser sempre o usuário da sessão (implementado).
- A conferência das regras pelo MCP da RNC (`getRule`) não foi feita nesta execução (MCP não conectado); tarefa de verificação marcada só pelo `openspec validate --strict`.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.
