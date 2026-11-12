# Design

## Context

Campos do cadastro, na ordem em que devem ser renderizados. A coluna *Componente* usa os nomes
genéricos mapeados para shadcn/ui no design da fundação. Colunas do modelo em
`001-project-foundation/design.md` › Contratos.

| Campo | Rótulo | Componente | Máscara | Comportamento | Obrigatório | Coluna da lista |
|---|---|---|---|---|---|---|
| numeroProcesso | Nº do processo | input | — | — | sim (`RK-776d8b62d6df`) | sim |
| numeroContrato | Nº do contrato | input | — | — | sim (`RK-04fd1cbfc346`) | sim |
| tipoContratoId | Tipo de contrato | select | — | lookup `/api/tipo_contratos`, exibe `nome` | sim (`RK-79134600b4be`) | não |
| modalidadeId | Modalidade | select | — | lookup `/api/modalidades`, exibe `nome` | não | não |
| numeroModalidade | Nº da modalidade | input | — | — | não | não |
| objeto | Objeto | textarea | — | — | sim (`RK-ee6cd831c2d4`, fundação) | sim |
| departamentoId | Unidade gestora | select | — | lookup `/api/departamentos`, exibe `deDepartamento` | sim (`RK-a0660a4fb262`) | sim |
| prestadorServicoId | Fornecedor | select | — | lookup `/api/prestadores_servicos`, exibe razão social | sim (`RK-37f294a3dc8e`) | sim |
| pessoaFisicaId | Gestor | command (busca) | — | lookup `/api/pessoas_fisicas`, grava o CPF | não | não |
| suplenteId | Gestor suplente | command (busca) | — | lookup `/api/pessoas_fisicas`, grava o CPF | não | não |
| dataInicio | Data de início | calendar | `dd/MM/yyyy` | — | sim (`RK-6b2806cfff8d`) | não |
| dataTermino | Data de vencimento | calendar | `dd/MM/yyyy` | — | sim (`RK-9d6599f5897d`) | sim |
| valorMensal | Valor mensal | input moeda | `R$` | `Decimal`, `RK-260f6b933f77` | não | não |
| valorTotal | Valor total | input moeda | `R$` | `Decimal`, `RK-5c46553fce3d` | não | sim |
| situacaoContratualId | Situação contratual | select | — | lookup `/api/situacao_contratual` | não | sim |
| projetoBasico | Projeto básico | textarea | — | — | não | não |
| anexo | Contrato (PDF) | input file | — | `savePdf()` | não | não |
| anexoPublicacao | Publicação (PDF) | input file | — | grava em `anexos_publicacao`, `RK-295d296eb4f7` | não | não |
| anexoFiscal | Relatório fiscal (PDF) | input file | — | grava em `anexos_fiscais`, `RK-b6f82ba63c1f` | não | não |

Campos derivados (não aparecem no formulário): `valorInicial` (`RK-c3fbde6dbf4a`), `dataInclusao`
(data do servidor), `parentId` (preenchido pela rota de aditivo).

## Filtros da lista

O legado tinha uma tela de pesquisa com `busca`, `campo`, `ordenar`, `buscaDepto`, `buscaGestor`,
`buscaGestorSuplente`, `vencendo`, `deRazaoSocial`, `deDepartamento` e `deNome`. Eles viram
parâmetros de `GET /api/contratos`, nunca colunas:

| Parâmetro | Filtra por |
|---|---|
| `q` | `numeroProcesso`, `numeroContrato` ou `objeto` contém o texto |
| `departamentoId` | unidade gestora |
| `prestadorServicoId` | fornecedor |
| `gestor` | CPF de `pessoaFisicaId` ou `suplenteId` |
| `situacaoContratualId` | situação |
| `vencendoEm` | `dataTermino` entre hoje e hoje + N dias |
| `sort` | `dataTermino`, `numeroContrato` ou `valorTotal`, com `asc`/`desc` |

## Goals / Non-Goals

**Goals:**
- Reproduzir o cadastro do legado sem inventar campo, tela ou regra.
- Cada `RK-…` aplicada em um ponto único e comentado do código.

**Non-Goals:**
- Migrar dados do legado.
- Relatórios gerenciais.

## Decisions

- **Aditivo é um contrato filho** — `POST /api/contratos/:id/aditivos` cria um contrato com `parentId = :id`, copiando tipo, objeto, unidade gestora e fornecedor do original; o operador informa vigência e valores.
- **`valorInicial`** — `RK-c3fbde6dbf4a`: no contrato original (`parentId` vazio), `valorInicial = valorTotal`; num aditivo, `valorInicial` não é recalculado.
- **Formatação de valores** — `RK-5c46553fce3d` e `RK-260f6b933f77`: o legado chamava `formataValor` antes de gravar; aqui o valor digitado em `1.234,56` é convertido para `Decimal` no servidor, no mesmo ponto, com o comentário da chave.
- **Anexos** — `RK-ed7bc4aaba15` e `RK-d2c51245ec1e` (fundação) e `RK-295d296eb4f7`, `RK-b6f82ba63c1f` (aqui) usam `savePdf()` de `001b-security-baseline`.
- **Validação dupla** — campos obrigatórios validados no formulário e na API; a API é a última palavra.

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Campos sem regra rastreada (`naPresidencia`, `prestacaoRealizada`, `numeroFiscais`, `periodo`, `anexoTipo`)] → ficam no modelo e fora do formulário até confirmação.

## Open Questions

- **Gestor e suplente** — confirmar pelo MCP da RNC se `pessoaFisicaId`/`suplenteId` são o gestor do contrato ou se a gestão vem de `fiscais`.
- **Valor total de aditivos** — o legado soma aditivos ao valor do contrato original em algum relatório (Acerto de Valor)? Confirmar antes da change de relatórios.
