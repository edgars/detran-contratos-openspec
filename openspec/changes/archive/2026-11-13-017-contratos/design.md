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
- **Implementação (apply)** — `src/lib/entities/contratos.ts` (tela) e `contratos.server.ts` (schema `zod` + kit de CRUD). Os obrigatórios com as mensagens exatas da spec ficam no schema (`RK-79134600b4be`, `RK-776d8b62d6df`, `RK-04fd1cbfc346`, `RK-6b2806cfff8d`, `RK-9d6599f5897d`, `RK-a0660a4fb262`, `RK-37f294a3dc8e`); `objeto` reusa `contratoFields.objeto` (`RK-879233539305`/`RK-ee6cd831c2d4`).
- **Lista com filtros próprios** — `GET /api/contratos` usa um handler próprio (não o `list` do kit) porque o kit só aceita `orderBy` fixo e o `sort` é escolhido pelo operador. Formato: `sort=campo:asc|desc` (ou `sort=campo&dir=desc`); padrão `id desc`. `vencendoEm=N` compara `dataTermino` (meia-noite UTC, como `parseDate` grava) com o dia de hoje do servidor até hoje + N, inclusive. `gestor` compara igualdade com `pessoaFisicaId` ou `suplenteId`. A lista mostra contratos originais e aditivos (todos são linhas de `contratos`).
- **Anexos de publicação e fiscal** — `anexoPublicacao`/`anexoFiscal` não são colunas de `contratos`: o `prepare` grava os PDFs com `savePdf()` (`ANEXO_PUBLICACAO`, `ANEXO_FISCAL`, mensagem "Erro ao incluir O arquivo anexo deve ser do tipo PDF!", a da spec) e o delegate do contrato cria, na mesma transação do contrato, as linhas em `anexos_publicacao` (`dataPublicacao` = data do servidor) e `anexos_fiscais` (`dataRegistro` = data do servidor). Na edição, um novo arquivo enviado acrescenta outra linha. O erro de PDF volta no próprio campo (`errors.anexoPublicacao`), para aparecer inline no formulário. `anexo` (PDF do contrato) usa `ANEXO_CONTRATO` (`RK-ed7bc4aaba15`). Nome de arquivo enviado como texto no corpo é rejeitado (só vale o que `savePdf` gravou na requisição).
- **Dinheiro** — `valorTotal`/`valorMensal` são validados no schema e convertidos com `toDecimal` no `beforeSave` (`RK-5c46553fce3d`, `RK-260f6b933f77`). Antes da conversão, um valor só com milhar (`1.234`) vira `1.234,00`, porque `toDecimal` leria `1.234` como 1,234 (ver relatório: defeito em `src/lib/money.ts`).
- **`valorInicial`** — calculado no `beforeSave` na criação e na edição de contrato sem `parentId` (`RK-c3fbde6dbf4a`); na edição de um aditivo (`parentId` preenchido) não é tocado; a rota de aditivo não grava `valorInicial` no aditivo nem altera o original. `dataInclusao` = data do servidor na criação. `valorInicial`, `parentId` e `dataInclusao` não são aceitos no corpo (400).
- **Aditivo** — `POST /api/contratos/:id/aditivos` aceita só `dataInicio`, `dataTermino`, `valorMensal`, `valorTotal` (schema estrito). Além de tipo, objeto, unidade gestora e fornecedor, copia também `numeroProcesso` e `numeroContrato` do original, porque `RK-776d8b62d6df`/`RK-04fd1cbfc346` exigem os dois em todo contrato e a spec não dá campo para o operador informá-los no aditivo. `GET /api/contratos/:id/aditivos` lista os aditivos paginados.
- **Página de detalhe** — `/contratos/[id]` (server component) mostra dados, anexos de publicação/fiscais e aditivos, com *Novo aditivo* → `/contratos/[id]/aditivos/new`. Como a lista do kit leva o 1º campo para `/edit`, a tela de edição tem o link *Ver contrato e aditivos*.
- **Gestor e suplente (busca)** — o kit não tem componente `command`; o campo usa o `lookup` do kit (select com as 100 primeiras pessoas de `/api/pessoas_fisicas`, rótulo `deNome`) e grava `idPessoaFisica` convertido em texto (ver Open Questions).

## Risks / Trade-offs

- [Regra ambígua implementada errado] → cada NEEDS REVIEW leva `// TODO(review): RK-…`; QA confere pelo MCP.
- [Campos sem regra rastreada (`naPresidencia`, `prestacaoRealizada`, `numeroFiscais`, `periodo`, `anexoTipo`)] → ficam no modelo e fora do formulário até confirmação.

## Open Questions

- **Gestor e suplente** — confirmar pelo MCP da RNC se `pessoaFisicaId`/`suplenteId` são o gestor do contrato ou se a gestão vem de `fiscais`.
- **Valor total de aditivos** — o legado soma aditivos ao valor do contrato original em algum relatório (Acerto de Valor)? Confirmar antes da change de relatórios.
- **CPF do gestor** — a spec manda gravar o CPF em `pessoaFisicaId`/`suplenteId` (`String`), mas `pessoas_fisicas` não tem coluna de CPF (e `idPessoaFisica` é `Int`, que não comporta um CPF de 11 dígitos). Decisão provisória: gravar `idPessoaFisica` como texto. Confirmar pelo MCP da RNC (`getSourceFile`) qual valor o legado gravava e de onde vem o CPF (talvez `pessoas.cpf`).
- **Busca do gestor** — o lookup do kit carrega só 100 registros (`size=100`) e não filtra por texto digitado; com muitas pessoas físicas é preciso um `command` com busca remota (`?q=`) no kit.
- **`ANEXO_CONTRATO_MODELO` (`RK-d2c51245ec1e`)** — não usado: a spec desta change exige a mensagem longa ("O arquivo anexo deve ser do tipo PDF!") para os anexos do cadastro. Confirmar em qual tela do legado vale a mensagem curta.
- **Exclusão** — excluir contrato com aditivos responde `409` (FK `parentId`); as linhas de `anexos_publicacao`/`anexos_fiscais` do contrato não têm FK e ficam órfãs ao excluir. Confirmar se devem ser apagadas junto.
- **Arquivo órfão** — se um anexo válido é gravado por `savePdf()` e outro anexo da mesma requisição falha, o primeiro arquivo fica no disco (nada vai para o banco).
- **MCP da RNC** — a conferência das `RK-…` desta change por `getRule` não foi feita nesta execução (MCP não conectado).
