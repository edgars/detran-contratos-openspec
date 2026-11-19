## MODIFIED Requirements

### Requirement: Listar TipoContratos
O sistema SHALL exibir em `/tipo_contratos` uma lista paginada de TipoContratos com busca e as colunas: `nome`, `gerenciamento`, `contratoPrincipal` ("Contrato") e `indicativoMetaRisco` ("Risco da meta"), as duas últimas como Sim/Não.

Alteração (019-relatorios): a lista ganha as colunas das duas marcações usadas pelos relatórios.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/tipo_contratos`
- **THEN** vê a tabela com as colunas `nome`, `gerenciamento`, Contrato e Risco da meta, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar TipoContratos
O sistema SHALL permitir criar um registro de TipoContratos em `/tipo_contratos/new` com os campos, nesta ordem: `nome`, `gerenciamento`, `contratoPrincipal`, `indicativoMetaRisco` e, por último, `prestacaoContas` (toggle da 021-prestacao-contas-fluxo).

Alteração (019-relatorios): acrescentados os toggles `contratoPrincipal` e `indicativoMetaRisco`, depois de `gerenciamento`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `tipo_contrato` e a lista o exibe

## ADDED Requirements

### Requirement: Marcações do tipo de contrato
O tipo de contrato SHALL guardar as marcações `S`/`N`, com padrão `N`, `contratoPrincipal` (conta como "Contrato" nos relatórios, no lugar do id fixo `Contrato::tipoContratoId` do legado) e `indicativoMetaRisco` (entra na lista "Em prorrogação/risco" da meta, `indicativo_meta_risco` do legado). Mais de um tipo pode ter cada marcação.

#### Scenario: Marcar o tipo Contrato
- **WHEN** o operador liga "É o tipo Contrato (relatórios)" no tipo "Contrato" e salva
- **THEN** o registro é gravado com `contratoPrincipal = 'S'` e a lista mostra "Sim" na coluna Contrato

### Requirement: Validação das marcações
A API de tipos de contrato SHALL aceitar só `S` ou `N` em `contratoPrincipal` e `indicativoMetaRisco` e, quando ausentes na criação, gravar `N`.

#### Scenario: Valor fora de S/N
- **WHEN** chega um `POST /api/tipo_contratos` com `contratoPrincipal: "X"`
- **THEN** a resposta é `400` com a mensagem do campo `contratoPrincipal` e nada é gravado

#### Scenario: Marcações ausentes
- **WHEN** chega um `POST /api/tipo_contratos` só com `nome` e `gerenciamento`
- **THEN** o registro é gravado com `contratoPrincipal` e `indicativoMetaRisco` iguais a `N`
