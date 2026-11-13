# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| busca | Busca | input | `###.###.###-##` | input mascarado | não | sim |
| pessoaFisicaCpf | Pessoa Física CPF | select | `###.###.###-##` | input mascarado | sim | sim |
| suplente | Suplente | toggle | — | — | sim | sim |
| presidente | Presidente | toggle | — | — | sim | sim |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **Validação dupla** — campos obrigatórios validados no formulário e na API; a API é a última palavra.
- **`busca` é filtro, não coluna nem campo** — por diretiva do autor (campos de pesquisa do legado são filtros da lista), `busca` é o parâmetro `?busca=` de `GET /api/fiscais`, que filtra por `pessoaFisicaCpf` (`contains`). Não aparece no formulário nem como coluna; o schema estrito recusa `busca` no corpo. O kit só tem filtros `select`/`lookup`/`number`: o filtro da tela aceita dígitos e a API aplica a máscara `###.###.###-##` (`applyMask(busca, MASKS.cpf)`) antes de comparar. A busca geral `q` também procura no CPF.
- **Colunas da lista** — no lugar da coluna `busca`, a lista mostra o contrato (`numeroContrato`), seguido de `pessoaFisicaCpf`, `suplente` e `presidente` (Sim/Não). O modelo `Fiscal` não tem relação Prisma com `Contrato`; o `GET /api/fiscais` acrescenta `contrato: { id, numeroContrato }` a cada item.
- **contratoId** — coluna NOT NULL fora do formulário da spec: acrescentada como primeiro campo, lookup obrigatório (`/api/contratos`, rótulo `numeroContrato`).
- **pessoaFisicaCpf** — o design indica `select` com máscara; não há fonte de opções rastreada, então o campo é input mascarado `MASKS.cpf` (texto, como a coluna). Vazio → "Pessoa Física CPF é obrigatório"; CPF fora da máscara → "CPF incompleto: use o formato ###.###.###-##" (`maskedString`).
- **suplente / presidente** — toggles `"S"`/`"N"` obrigatórios (RK-0f7caf172fab, RK-6b60cd49b7ed via `fiscalFields`); a API recusa valor diferente de S/N.
- **dataInclusao** — preenchida com a data do servidor no `beforeSave` da criação; não é campo do formulário e o cliente não pode enviá-la. A edição preserva o valor original.

## Open Questions

- A conferência das regras (RK-0f7caf172fab, RK-6b60cd49b7ed) com `getRule` pelo MCP da RNC não foi feita nesta execução (MCP não conectado).
- `pessoaFisicaCpf` como `select` no legado (provavelmente lista de pessoas físicas por CPF): confirmar pelo MCP; hoje é input mascarado.
- O lookup `/api/contratos` depende da change 017-contratos; até lá o select de contrato fica vazio.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.
