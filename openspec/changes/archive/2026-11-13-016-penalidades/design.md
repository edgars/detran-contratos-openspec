# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| arquivo | Arquivo | input | — | — | não | sim |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **Upload por `savePdf`** — campo `arquivo` do tipo `file` (multipart); no `prepare` a inclusão sempre passa o arquivo por `savePdf(…, ARQUIVO_PENALIDADE)`: sem arquivo → "Erro ao incluir Não existe arquivo para anexar!" (RK-abb6ac79fad7); conteúdo sem assinatura `%PDF-` → "Erro ao incluir O arquivo anexo deve ser do tipo PDF!" (RK-174d58601890). Erro devolvido no campo `arquivo`.
- **Obrigatoriedade do arquivo** — tasks.md diz "obrigatórios: nenhum" e a coluna é anulável, mas as regras do legado recusam a inclusão sem PDF. Decisão: arquivo exigido na inclusão, opcional na edição (mantém o atual; nome enviado pelo cliente é descartado).
- **Autoria pela sessão** — `userId` (e `dataRegistro`) enviados pelo cliente são descartados no `prepare` (em vez de gerar `400` pelo schema estrito); na inclusão o `beforeSave` grava `withAuthor(data, user)` e `dataRegistro` = data do servidor. Na edição autoria e data de registro originais são preservadas.
- **`contratoId`** — coluna NOT NULL ausente do formulário da spec: lookup obrigatório (`/api/contratos`, rótulo `numeroContrato`); contrato inexistente → `400` no campo.
- **Lista** — só a coluna `arquivo` (formato `file`), conforme a spec.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.

## Open Questions

- A conferência das chaves `RK-…` pelo `getRule` do MCP da RNC não foi feita nesta execução (MCP não conectado); as regras foram implementadas conforme o texto de `src/lib/rules`.
- Confirmar se a edição de uma penalidade deveria trocar a autoria para quem editou (implementado: autoria da inclusão preservada).
