# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| anexo | Anexo | input | — | — | sim | sim |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **Validação dupla** — campos obrigatórios validados no formulário e na API; a API é a última palavra.
- **`anexo` é o nome gerado por `savePdf`** — o campo do formulário é `file` (multipart). No `prepare` do `crudHandlers`, a inclusão sempre passa `raw.anexo` por `savePdf(…, ANEXO_FISCAL)`: sem arquivo responde `400` com "Erro ao incluir Não existe arquivo para anexar!" (RK-23cdd0c37c3c) e arquivo cujo conteúdo não começa com `%PDF-` responde "Erro ao incluir O arquivo anexo deve ser do tipo PDF!" (RK-01658245d11b). O erro de upload é devolvido no campo `anexo` (erro inline), não em `_`. Um texto enviado no lugar do arquivo nunca é aceito como nome.
- **Edição sem arquivo novo** — o anexo atual é mantido (relido do banco no `prepare`); o nome enviado pelo cliente é descartado. Com arquivo novo, ele substitui o nome gravado (o PDF antigo continua no disco).
- **Obrigatoriedade de `anexo`** — o schema usa `anexoFiscalFields.anexo` (RK-9da08201400b, RK-0e70b6c81ee9). Na prática a mensagem do cenário "Salvar sem um campo obrigatório" é a do legado (RK-23cdd0c37c3c), pois a ausência de arquivo é detectada por `savePdf` antes do schema.
- **`contratoId`** — coluna NOT NULL ausente do formulário da spec: virou lookup obrigatório (`/api/contratos`, rótulo `numeroContrato`); o `beforeSave` recusa contrato inexistente com `400` no campo (o modelo não tem FK).
- **`dataRegistro`** — coluna NOT NULL preenchida com a data do servidor na inclusão (RK-211b91bb389e fora de escopo); não é campo do formulário e não muda na edição.
- **Lista** — só a coluna `anexo`, em formato `file` (link de download por `/api/arquivos/<nome>`, com sessão). A busca `q` procura no nome gravado.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.

## Open Questions

- A conferência das chaves `RK-…` pelo `getRule` do MCP da RNC não foi feita nesta execução (MCP não conectado); as regras foram implementadas conforme o texto de `src/lib/rules`.
