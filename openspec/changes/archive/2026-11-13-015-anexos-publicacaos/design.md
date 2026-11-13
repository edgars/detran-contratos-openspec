# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| anexo | Anexo | input | — | — | não | sim |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **Upload por `savePdf`** — campo `anexo` do tipo `file` (multipart); no `prepare` a inclusão sempre passa o arquivo por `savePdf(…, ANEXO_PUBLICACAO)`: sem arquivo → "Erro ao incluir Não existe arquivo para anexar!" (RK-e2b53b79c3c2); conteúdo sem assinatura `%PDF-` → "Erro ao incluir O arquivo anexo deve ser do tipo PDF!" (RK-9aa2ad64672e). Erro devolvido no campo `anexo`.
- **Obrigatoriedade do arquivo** — design.md/tasks.md dizem "obrigatórios: nenhum" e a coluna é anulável, mas as regras do legado RK-e2b53b79c3c2/RK-9aa2ad64672e recusam a inclusão sem PDF. Decisão: arquivo exigido na inclusão (regra do legado), opcional na edição (sem arquivo novo mantém o atual; nome enviado pelo cliente é descartado). O campo não leva asterisco no formulário (segue o design) e traz a descrição "exigido na inclusão".
- **`contratoId` e `dataPublicacao`** — colunas NOT NULL ausentes do formulário da spec: viraram lookup obrigatório (`/api/contratos`, rótulo `numeroContrato`) e data obrigatória (`dd/MM/yyyy`). Contrato inexistente → `400` no campo.
- **Lista** — só a coluna `anexo` (formato `file`), conforme a spec.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.

## Open Questions

- A conferência das chaves `RK-…` pelo `getRule` do MCP da RNC não foi feita nesta execução (MCP não conectado); as regras foram implementadas conforme o texto de `src/lib/rules`.
- O formulário da spec tem só `anexo`; `contratoId` e `dataPublicacao` foram acrescentados por serem NOT NULL. Confirmar se o legado preenchia `dataPublicacao` pelo usuário ou pelo servidor.
