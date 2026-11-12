# Design

## Context

Campos da tela legada, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| codigo | Código | read-only | — | — | não | não |
| diretoriaId | Diretoria ID | input | — | — | sim | sim |
| id | ID | read-only | — | — | sim | não |
| deDepartamento | De Departamento | read-only | — | — | sim | não |
| deLogradouro | De Logradouro | read-only | — | — | não | não |
| deComplemento | De Complemento | read-only | — | — | não | não |
| deBairro | De Bairro | read-only | — | — | não | não |
| deCidade | De Cidade | read-only | — | — | não | não |
| cep | CEP | read-only | `#####-###` | input mascarado | não | não |
| municipioId | Município ID | read-only | — | — | não | não |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Funcionalidades que o legado não tinha.

## Decisions

- **`diretoriaId` é um lookup de Diretorias** — select carregado de `/api/diretorias`; grava o id do registro escolhido.
- **Validação dupla** — campos obrigatórios validados no formulário e na API; a API é a última palavra.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.
