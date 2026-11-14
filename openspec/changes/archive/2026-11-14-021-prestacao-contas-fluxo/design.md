# Design

## Context

Evidência do legado: `docs/legado/prestacao-contas.md` (lido do MCP da RNC com `getSourceFile` em
13/11/2026). Resumo do que o legado faz:

| Legado | Regra |
|---|---|
| `prestacao` | Contratos com `tipo_contrato_id IN PrestacaoConta::tiposContratos` (produção: 3,4,5,6,7,8,9,10,11,13), `parent_id IS NULL`, `data_termino < hoje`, `valor_total > 650.000`; alterna `prestacao_realizada = 0` (pendentes) / `= 1` (realizadas); busca por coluna; ordenação; filtros de tipo e modalidade; 10 por página |
| `fluxo` | Fases com `periodo` = prazo escolhido, com descrição e "atendido" |
| `manterPrestacao`, `prestacaoAjax` | Gravar fase cria linha em `prestacao_contas` (fase, contrato, usuário, descrição, atendido); `periodo == 30` e `atendido == 1` → `contratos.prestacao_realizada = 1` |
| painel | Dias desde o vencimento; meses desde o início (`PERIOD_DIFF(now, data_inicio)`) |
| ACL | `Util->verificaPermissao()`, grupo `PrestacaoConta` (`docs/legado/perfis-acesso.md`) |

Estado atual do app (código lido em 13/11/2026):

- `prisma/schema.prisma`: `PrestacaoConta { descricao String?, atendido String? ("S"/"N"), dataInclusao DateTime?, faseId Int, userId Int, contratoId Int }` sem FKs; `Fase { nome String, periodo String }`; `Contrato.prestacaoRealizada String?` (nunca gravada); `TipoContrato { nome, gerenciamento, indicativoMetaRisco }`.
- `src/lib/entities/prestacao_contas.server.ts`: CRUD pelo kit (`crudHandlers`), autoria por `withAuthor`, `dataInclusao` do servidor, schema `zod` estrito.
- `src/app/(app)/prestacao_contas/{page.tsx,new,[id]/edit}`: cadastro solto (lista `descricao`/`atendido`).
- `src/lib/entities/contratos.server.ts`: "hoje" é a meia-noite UTC do dia do servidor (`contratosWhere`), porque `dataTermino` é gravada como meia-noite UTC.

Não há chave `RK-…` para as regras de prestação de contas em `docs/legado/rk-conferencia.md` (as 64
regras citadas são obrigatoriedades e regras de contratos). Os requisitos citam o documento do
legado; ver Open Questions.

### Lista (`/prestacao_contas`)

| Coluna | Origem | Formato |
|---|---|---|
| Nº processo | `numeroProcesso` | texto |
| Nº contrato | `numeroContrato` | texto (link para o fluxo) |
| Vencimento | `dataTermino` | `dd/MM/yyyy` |
| Objeto | `objeto` | texto |
| Dias | dias desde o vencimento (derivado) | inteiro |
| Valor total | `valorTotal` | `R$` |
| Contratada | `prestadorServico.deRazaoSocial` | texto |
| UN gestora | `departamento.deDepartamento` | texto |

Parâmetros de `GET /api/prestacao_contas/contratos` (filtros, nunca colunas — diretiva do autor):

| Parâmetro | Valores | Efeito |
|---|---|---|
| `situacao` | `pendentes` (padrão) \| `realizadas` | pendentes: `prestacaoRealizada` nulo ou diferente de "1"; realizadas: `= "1"` |
| `campo` | `unGestora`, `gestor`, `contratada`, `numeroContrato`, `numeroProcesso`, `objeto` (padrão `objeto`) | coluna onde `q` é procurado |
| `q` | texto | `contains` na coluna escolhida (o `busca` do legado) |
| `ordenar` | `contratada`, `vencimento`, `valor`, `unGestora`, `gestor` (padrão `vencimento`) | ordenação |
| `dir` | `asc` (padrão) \| `desc` | sentido |
| `tipoContratoId` | id | só tipos marcados; tipo não marcado → lista vazia |
| `modalidadeId` | id | modalidade |
| `page`, `size` | | paginação; a tela pede `size=10` |

### Fluxo (`/prestacao_contas/[contratoId]`)

`GET /api/prestacao_contas/contratos/:id?periodo=<p>` devolve:

```
{
  contrato: { id, numeroProcesso, numeroContrato, objeto, dataInicio, dataTermino, valorTotal,
              prestacaoRealizada, departamento, prestadorServico, tipoContrato, modalidade },
  diasDesdeVencimento: number,   // negativo se ainda não venceu
  mesesDesdeInicio: number | null,
  realizada: boolean,
  prazos: string[],              // valores distintos de fases.periodo
  periodo: string | null,        // prazo efetivo (parâmetro ou o primeiro de `prazos`)
  fases: [{ id, nome, periodo, ultimo: { descricao, atendido, dataInclusao, usuario } | null }],
  historico: [{ id, dataInclusao, fase: { id, nome, periodo }, descricao, atendido, usuario }]
}
```

`usuario` sai como `{ id, username }` (nunca campo de senha; `publicUser` não é necessário porque o
`select` só traz esses dois campos).

## Goals / Non-Goals

**Goals:**
- Reproduzir as telas `prestacao` e `fluxo` do legado e a regra de conclusão.
- Trocar ids fixos de tipo de contrato por configuração no cadastro de tipos.
- Manter as diretivas do autor: vencimento só pela `dataTermino` do contrato original, schema `zod` estrito, autoria pela sessão, filtros que não viram colunas, shadcn/ui.

**Non-Goals:**
- Permissão por perfil (023), migração de dados (025), impressão, desfazer conclusão.

## Decisions

- **Critério de tipo: flag em `tipo_contrato`.** Coluna `prestacaoContas String @default("N")` (TEXT NOT NULL DEFAULT 'N'), valores "S"/"N", mesmo padrão de `gerenciamento`. Toggle "Sujeito à prestação de contas" no formulário de `/tipo_contratos`, depois dos campos existentes (`FieldDef` `kind: "toggle"`, `toggleValues: ["S", "N"]`), e opcional no schema `zod` de `tipo_contratos.server.ts` (ausente na criação → default "N" do banco). Alternativas descartadas: variável de ambiente com ids (ids diferem entre dev e produção, como notado em `docs/legado/relatorios.md`, e mudar exige redeploy); tabela de configuração separada (mais uma tela para um único booleano). A marcação dos ids legados (3–11, 13) é tarefa da carga do dump (025).
- **Requisito novo em `tipo-contratos` como ADDED, não MODIFIED.** A `019-relatorios` também mexe em `tipo-contratos`; copiar agora "Criar TipoContratos" inteiro num MODIFIED sobrescreveria, no arquivamento, o que a 019 mudar no mesmo requisito. O ADDED declara o toggle sem reescrever a ordem de campos dos outros requisitos.
- **Limite de valor: constante, não configuração.** `export const PRESTACAO_VALOR_MINIMO = new Prisma.Decimal("650000.00")` em `src/lib/prestacao/criterios.ts`, comparação estrita (`valorTotal > limite`, `gt`), com comentário citando `docs/legado/prestacao-contas.md`. Diferente dos ids de tipo, o valor é o mesmo em todos os ambientes e é regra de negócio; mudá-lo deve passar por uma change e um teste, não por variável esquecida no servidor. Contrato com `valorTotal` nulo não entra.
- **Vencido.** `dataTermino < hoje`, "hoje" = meia-noite UTC do dia do servidor (mesma convenção de `contratosWhere`), só contratos originais (`parentId: null`), só a `dataTermino` do próprio contrato (diretiva do autor 13/11/2026; aditivos não estendem).
- **Situação.** Pendentes = `OR: [{ prestacaoRealizada: null }, { prestacaoRealizada: { not: "1" } }]` (legado: `= 0`; nulo tratado como não realizado porque a coluna nunca foi gravada no app novo). Realizadas = `prestacaoRealizada: "1"`.
- **Onde fica o critério.** Uma função `prestacaoWhere(params, now)` em `src/lib/prestacao/criterios.ts` monta o `Prisma.ContratoWhereInput` (tipo marcado via relação `tipoContrato: { prestacaoContas: "S" }`, original, vencido, valor, situação, `tipoContratoId`, `modalidadeId`, busca). Lista e testes usam a mesma função.
- **Busca por coluna.** `campo` escolhe uma coluna; `q` usa `contains` (parametrizado). `unGestora` → `departamento.deDepartamento`; `contratada` → `prestadorServico.deRazaoSocial`; `gestor` → ids das `pessoas_fisicas` cujo `deNome` contém `q`, comparados com `contratos.pessoaFisicaId` pela mesma chave que a tela de detalhe do contrato usa hoje (`idPessoaFisica` como texto, `getContratoDetalhe`); a resolução fica num helper único `gestorKeysPorNome(q)` para acompanhar a troca para CPF se outra change a fizer (`docs/legado/chaves-pessoas-fornecedores.md`). `campo` inválido → `400 { errors: { campo } }`.
- **Ordenação.** `contratada` → `prestadorServico.deRazaoSocial`; `vencimento` → `dataTermino`; `valor` → `valorTotal`; `unGestora` → `departamento.deDepartamento`; todas com desempate `id desc`. `gestor`: o Prisma não ordena por um campo sem relação, então a API busca `{ id, pessoaFisicaId }` de todos os contratos do filtro (conjunto pequeno: vencidos acima de R$ 650 mil de tipos marcados), resolve os nomes em `pessoas_fisicas`, ordena em memória (sem gestor por último) e pagina. `ordenar` ou `dir` inválido → padrão (`vencimento asc`), sem erro.
- **Dias e meses.** `diasDesdeVencimento = (hoje − dataTermino) / 86.400.000` em datas de calendário UTC (mesma conta de `diasAte` em `src/app/(app)/contratos/[id]/page.tsx`, com sinal invertido). `mesesDesdeInicio = (anoHoje·12 + mêsHoje) − (anoInício·12 + mêsInício)`, ignorando o dia, como `PERIOD_DIFF(now, data_inicio)`; `null` se `dataInicio` vazia. Funções puras `diasDesdeVencimento(dataTermino, now)` e `mesesDesdeInicio(dataInicio, now)` em `src/lib/prestacao/criterios.ts`.
- **Prazos.** `prazos` = valores distintos de `fases.periodo` (texto, aparado), ordenados numericamente quando numéricos e, depois, alfabeticamente. Sem `periodo` na URL, vale o primeiro. A escolha fica só na URL (`?periodo=`), não é gravada.
- **Gravar fase.** `POST /api/prestacao_contas` continua no kit (`crudHandlers`), com schema estrito `{ contratoId (int, obrigatório), faseId (int, obrigatório), descricao (opcional), atendido ("S"|"N", opcional) }`. `prepare` descarta `userId` e `dataInclusao` enviados (regra atual); `beforeSave` confere que fase e contrato existem, grava `dataInclusao = new Date()` e `userId` da sessão (`withAuthor`). Cada gravação cria uma linha nova (o legado cria registro); a tela mostra a última por fase e o histórico.
- **Regra de conclusão.** Delegate próprio no kit (como `contratoDelegate` em `contratos.server.ts`): `create` roda `prisma.$transaction` que insere a linha e, se `fase.periodo.trim() === "30"` e `atendido === "S"`, faz `contrato.update({ prestacaoRealizada: "1" })`. Ponto único: `concluiSeFaseFinal(tx, fase, atendido, contratoId)` em `src/lib/prestacao/criterios.ts`, com comentário citando `docs/legado/prestacao-contas.md` (`periodo == 30 && atendido == 1`). O valor "1" segue o legado (`prestacao_realizada = 1`) e o tipo String da coluna. Gravar atendido = "N" numa fase 30 não desfaz a conclusão.
- **Tela atual de cadastro solto: substituída.** O legado não tinha CRUD livre de `prestacao_contas` (ações `prestacao`, `fluxo`, `manterPrestacao`; `docs/legado/perfis-acesso.md`). O cadastro solto permite gravar fase sem passar pela regra de conclusão, escolher qualquer contrato (inclusive aditivo) e editar ou apagar o andamento já registrado (inclusive de outro usuário, trocando o autor). Manter em paralelo criaria dois caminhos de gravação; deixar só leitura em `/prestacao_contas` ocuparia a rota que o menu "Prestação de contas" precisa para a lista do legado. Ficam: `GET /api/prestacao_contas` (com filtro `contratoId`) e `GET /api/prestacao_contas/:id`, só leitura; o histórico do fluxo mostra todos os registros. Saem: páginas `new/` e `[id]/edit/`, `PUT` e `DELETE` (rota sem o método exportado → `405` do Next).
- **Telas (shadcn/ui).** Lista: `Tabs` (Pendentes/Realizadas, `?situacao=` na URL) + `EntityList` com `api="/api/prestacao_contas/contratos"`, `extraParams={{ situacao }}`, `pageSize={10}`, `canCreate={false}`, `rowHref="/prestacao_contas/{id}"` e `filters` = `campo` (select), `ordenar` (select com as opções asc/desc combinadas, ex.: `valor:desc`), `tipoContratoId` (lookup `/api/tipo_contratos?prestacaoContas=S`, exibe `nome`) e `modalidadeId` (lookup `/api/modalidades`). Para isso `EntityList` ganha `pageSize?: number` (padrão 20) e `extraParams?: Record<string, string>` (somados à query e à dependência do `load`). A API aceita `ordenar=valor:desc` além de `ordenar=valor&dir=desc`. Fluxo: `Card` do painel (processo, contrato, contratada, UN gestora, tipo, vencimento, valor total, "Vencido há N dias", "N meses desde o início", selo Pendente/Realizada), `Select` do prazo, `Table` das fases com `Textarea` (descrição), `Switch` (atendido) e `Button` "Gravar" por linha (toast `sonner` ao gravar; erros `400` inline), e `Table` do histórico (data `dd/MM/yyyy`, fase, descrição, atendido Sim/Não, usuário). `GET /api/tipo_contratos` ganha filtro `?prestacaoContas=S|N` no `listWhere` existente.
- **Breadcrumb.** "Prestação de contas › Pendentes" / "› Realizadas" conforme a aba; no fluxo, "Prestação de contas › Contrato <numeroContrato>".

## Risks / Trade-offs

- [Nenhum tipo marcado depois do deploy → lista vazia] → a migração cria a coluna com "N"; a 025 marca os ids legados na carga; até lá o administrador marca em `/tipo_contratos`. Teste cobre "nenhum tipo marcado → lista vazia".
- [Conflito com a 019 em `tipo-contratos`] → requisito ADDED, sem MODIFIED; se a 019 alterar `tipo_contratos.ts`/`tipo_contratos.server.ts`, quem aplicar a 021 junta o toggle ao que estiver lá.
- [Ordenação por gestor em memória] → aceitável pelo tamanho do conjunto filtrado; se crescer, trocar por `$queryRaw` com `LEFT JOIN pessoas_fisicas`.
- [Remover PUT/DELETE quebra quem usava o cadastro solto] → é o objetivo; registros continuam legíveis no histórico.
- [Comparação de `periodo` como texto] → `fases.periodo` é String; "30", " 30" e "30 " concluem; "30 dias" não. Ver Open Questions.
- [Sem permissão por perfil até a 023] → igual ao resto do app hoje (qualquer sessão válida).

## Open Questions

- Existem chaves `RK-…` para as regras de prestação de contas (critérios da lista e conclusão com período 30)? `docs/legado/rk-conferencia.md` não lista nenhuma; se existirem, citá-las nos comentários e nos requisitos.
- O "prazo escolhido" do fluxo era gravado em `contratos.periodo` no legado? A coluna existe e a 017 a deixou fora do formulário. Esta change não grava (escolha só na tela).
- No legado, gravar a mesma fase de novo criava outra linha ou atualizava a existente? Esta change cria sempre uma linha nova (o documento diz "cria registro").
- Quais são os valores reais de `fases.periodo` em produção (só números, como "30"?) e em que ordem o legado mostrava os prazos e a lista (ordenação padrão)?
- O fluxo deve recusar contrato que não atende aos critérios (ex.: aditivo, não vencido)? Esta change só exige que o contrato exista.
- A permissão de prestação de contas é perfil próprio ou capacidade do Gestor de contrato (`docs/legado/perfis-acesso.md`)? Decisão da 023.

### Registro do apply (14/11/2026)

- **RK-…**: o MCP da RNC não estava conectado no apply (`RNC_MCP_URL` ausente); `findRules` não foi rodado. Os pontos de regra levam `// Legado: docs/legado/prestacao-contas.md — …` em `src/lib/prestacao/criterios.ts` e `src/lib/entities/prestacao_contas.server.ts`. Continua aberto.
- **Chave do gestor**: a 022 trocou `contratos.pessoaFisicaId` para CPF (11 dígitos) e criou `pessoasPorCpf` em `src/lib/reference/pessoas.ts`. `gestorKeysPorNome` devolve `pessoas_fisicas.cpf` (não mais `idPessoaFisica`) e `nomesGestores` usa `pessoasPorCpf` (só leitura, sem editar o helper). A lista não exibe coluna de gestor (não está entre as colunas do legado); o nome só é usado na busca e na ordenação.
- **Ordem das colunas**: o `EntityList` faz da 1ª coluna o link da linha; para cumprir "Nº contrato (link para o fluxo)", a lista começa por Nº contrato e depois Nº processo (o legado mostra processo antes de contrato). A linha inteira também abre o fluxo.
- **Página 1 ao trocar de aba**: o `EntityList` da 024 não volta à página 1 quando `extraParams` muda; a tela remonta a lista com `key={situacao}` (efeito colateral: busca e filtros são limpos ao trocar de aba). Se a 024 passar a reiniciar a página, basta tirar o `key`.
- **Ordenação na tela**: a ordenação é o filtro "Ordenar por" (`ordenar=campo:dir`), não cabeçalho clicável; a API não lê `sort=`.
- **Fluxo de contrato que não atende aos critérios**: aberto para qualquer contrato existente (inclusive aditivo); `/prestacao_contas/<texto>` (ex.: `/new`) responde 404.
- **Ordem das fases dentro do prazo**: por `id` (ordem de cadastro); o legado não documenta.
- **Breadcrumb**: `src/components/shell/app-breadcrumb.tsx` ganhou `BreadcrumbOverride` (a página declara o último rótulo, "Contrato 010/2024", ou acrescenta a aba "Pendentes"/"Realizadas").
- **Selo do prazo final**: a tela avisa, no prazo "30", que gravar com Atendido ligado conclui; o toast diz quando a gravação concluiu.

