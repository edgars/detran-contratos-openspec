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
- **Campos editáveis apesar de *read-only* no Context** — o design marca quase todos os campos como read-only (herança da tela de consulta do legado), mas a spec exige criar e editar. `codigo`, `deDepartamento`, `deLogradouro`, `deComplemento`, `deBairro`, `deCidade`, `cep` e `diretoriaId` são editáveis no formulário e no schema da API. `id` (chave autoincremento) e `municipioId` (sem tabela de municípios e sem origem de escolha traçada) ficam somente leitura: aparecem no formulário, mas não são aceitos pela API (schema estrito → 400).
- **`id` obrigatório** — atendido pela chave primária gerada pelo banco; o operador não informa `id`.
- **Rótulo do lookup de diretoria** — o select e a coluna da lista exibem `deDiretoria` (rótulo legível), não `codigo` como diz a tarefa 3.4; o valor gravado continua sendo o id.
- **Busca da lista** — `q` procura em `deDepartamento` e `codigo`; a busca por `diretoriaId` (tarefa 2.1) é o parâmetro `?diretoriaId=` da lista, exposto como filtro lookup na tela.
- **FK `diretoriaId`** — o `beforeSave` confere se a diretoria existe e responde `400 { diretoriaId: "Diretoria não encontrada" }` em vez de erro do banco.
- **`cep`** — máscara `MASKS.cep` (`#####-###`) no formulário; a API aceita vazio (nulo) ou valor que completa a máscara, senão `400`.
- **Campos opcionais apagáveis** — texto vazio vira `null` na API, para que limpar um campo na edição de fato apague o valor (o `optionalString()` do kit transforma vazio em `undefined`, o que deixaria o valor antigo).
- **`deDepartamento`** — usa `departamentoFields.deDepartamento` (RK-4e6358dbafbf RK-52fdc2d97389 RK-ecfa90099032).

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Coluna inventada para campo a confirmar] → sem origem confirmada, o campo não vira coluna.

## Open Questions

- **Conferência pelo MCP da RNC** — a tarefa 4.2 pede `getRule` para cada `RK-…`; a conferência pelo MCP não foi feita nesta execução (MCP não conectado). As chaves foram aplicadas como estão na fundação (`src/lib/rules`).
- Serviço de endereço (ViaCEP) não aplicado ao `cep`: a coluna *Comportamento* do design não pede preenchimento automático. Confirmar se o legado preenchia endereço pelo CEP.
- `municipioId` fica somente leitura: não há tabela de municípios nem lookup traçado. Confirmar a origem (IBGE?) antes de torná-lo editável.
