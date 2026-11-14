## Purpose

Relatórios gerenciais de contratos: a aplicação SHALL oferecer os seis relatórios do legado (`relatorios_controller.php`, docs/legado/relatorios.md) — Contratos por gestor, Contratos vencendo, Contratos vencidos, Cadastro incompleto, Acompanhamento de meta e Acerto de valor — com os mesmos filtros, regras e colunas, exportação CSV e impressão em PDF.

## ADDED Requirements

### Requirement: Índice de relatórios
O sistema SHALL exibir em `/relatorios` um índice com os seis relatórios, cada um com título, descrição curta e link para a sua rota: `/relatorios/contratos-por-gestor`, `/relatorios/contratos-vencendo`, `/relatorios/contratos-vencidos`, `/relatorios/cadastro-incompleto`, `/relatorios/acompanhamento-meta` e `/relatorios/acerto-valor`.

#### Scenario: Abrir o índice
- **WHEN** o operador logado abre `/relatorios`
- **THEN** vê os seis relatórios
- **AND** cada link abre a rota do relatório correspondente

### Requirement: Só contratos originais e vencimento do próprio contrato
Todo relatório SHALL considerar só contratos originais (`parentId` nulo), como o legado (`parent_id IS NULL`, docs/legado/relatorios.md), e SHALL calcular vencimento, vigência e dias para vencer só pela `dataTermino` do próprio contrato, nunca pela de um aditivo (diretiva do autor de 13/11/2026). "Hoje" é o dia do servidor à meia-noite UTC, a mesma convenção da lista de contratos.

#### Scenario: Aditivo não aparece
- **GIVEN** um contrato original com `dataTermino` daqui a 10 dias e um aditivo dele com `dataTermino` daqui a 15 dias
- **WHEN** o operador gera Contratos vencendo com 30 dias
- **THEN** o relatório mostra o contrato original com vencimento daqui a 10 dias
- **AND** não mostra o aditivo

#### Scenario: Prorrogação por aditivo não muda o vencimento
- **GIVEN** um contrato original com `dataTermino` há 5 dias e um aditivo com `dataTermino` daqui a 300 dias
- **WHEN** o operador gera Contratos vencidos com período que inclui a data de 5 dias atrás
- **THEN** o contrato original aparece como vencido

### Requirement: Tipo Contrato configurável
Os relatórios que o legado restringia ao tipo "Contrato" (`tipo_contrato_id = Contrato::tipoContratoId`, id fixo 10 em produção) SHALL usar os tipos de contrato marcados com `contratoPrincipal = 'S'`, e o risco da meta SHALL usar os tipos com `indicativoMetaRisco = 'S'`; nenhum id de tipo de contrato SHALL estar fixo no código.

#### Scenario: Tipo marcado entra no relatório
- **GIVEN** o tipo "Contrato" com `contratoPrincipal = 'S'`, o tipo "Convênio" com `contratoPrincipal = 'N'` e um contrato vigente sem anexo de cada tipo
- **WHEN** o operador abre Cadastro incompleto
- **THEN** só o contrato do tipo "Contrato" aparece

### Requirement: Aviso sem tipo Contrato
Sem nenhum tipo de contrato marcado com `contratoPrincipal = 'S'`, Cadastro incompleto e Acompanhamento de meta SHALL mostrar o aviso "Nenhum tipo de contrato está marcado como Contrato." com link para `/tipo_contratos`, em vez de uma lista vazia sem explicação.

#### Scenario: Nenhum tipo marcado
- **GIVEN** nenhum tipo de contrato com `contratoPrincipal = 'S'`
- **WHEN** o operador abre Acompanhamento de meta
- **THEN** vê o aviso "Nenhum tipo de contrato está marcado como Contrato." com link para `/tipo_contratos`

### Requirement: Contratos por gestor
O sistema SHALL exibir em `/relatorios/contratos-por-gestor` os contratos originais agrupados por gestor (`pessoaFisicaId`, CPF), tipo de contrato e unidade gestora, com as colunas Qtde (quantidade de contratos), Tipo, Valor acumulado (soma de `valorTotal` em `Decimal`), Gestor (nome da pessoa física do CPF, por `pessoas_fisicas.cpf`) e UN Gestora, filtrando opcionalmente por gestor e por unidade gestora (docs/legado/relatorios.md, tela `gestores`).

#### Scenario: Agrupar e somar
- **GIVEN** o gestor de CPF 12345678901 com dois contratos originais do tipo "Contrato" na unidade "DIAFI", de `R$ 1.000,10` e `R$ 2.000,25`
- **WHEN** o operador gera o relatório sem filtros
- **THEN** há uma linha com Qtde 2, Tipo "Contrato", Valor acumulado `R$ 3.000,35`, o nome do gestor e UN Gestora "DIAFI"

#### Scenario: Contratos sem gestor
- **GIVEN** um contrato original sem `pessoaFisicaId`
- **WHEN** o operador gera o relatório sem filtros
- **THEN** o contrato é contado num grupo com Gestor "Sem gestor"

#### Scenario: Filtrar por gestor e unidade
- **GIVEN** contratos de dois gestores em duas unidades
- **WHEN** o operador escolhe um gestor e uma unidade e gera o relatório
- **THEN** só aparecem os grupos daquele gestor naquela unidade

### Requirement: Lista de gestores do filtro
O filtro Gestor de Contratos por gestor SHALL oferecer só as pessoas que são gestoras (`pessoaFisicaId`) de algum contrato original, pelo nome, com o CPF como valor, a partir de `GET /api/relatorios/contratos-por-gestor/gestores`.

#### Scenario: Só quem é gestor
- **GIVEN** a pessoa A gestora de um contrato original e a pessoa B sem contrato
- **WHEN** o operador abre o filtro Gestor
- **THEN** vê A e não vê B

### Requirement: Contratos vencendo
O sistema SHALL exibir em `/relatorios/contratos-vencendo` os contratos originais cujo vencimento está a mais de 0 e menos de `dias` dias de hoje (`data_termino - hoje > 0` e `< Dias`, docs/legado/relatorios.md, tela `vencendo`); com período informado (`inicio` e `fim`, `dd/MM/yyyy`), SHALL exigir também `dataTermino` entre as duas datas, inclusive. Colunas, nesta ordem: Contratada, Gestor, UN Gestora, Tipo, Contrato, Processo, Objeto, Valor total, Vencimento.

#### Scenario: Vencendo em N dias
- **GIVEN** contratos originais vencendo hoje, daqui a 10 dias e daqui a 40 dias
- **WHEN** o operador gera o relatório com 30 dias
- **THEN** só aparece o contrato que vence daqui a 10 dias
- **AND** o título é "Contratos vencendo em 30 dias"

#### Scenario: Vencendo dentro de um período
- **GIVEN** contratos vencendo daqui a 5 e daqui a 20 dias
- **WHEN** o operador gera com 30 dias e período de hoje + 15 a hoje + 25
- **THEN** só aparece o que vence daqui a 20 dias

### Requirement: Filtros de Contratos vencendo
Em Contratos vencendo, `dias` SHALL ser obrigatório, inteiro de 1 a 3650, e a ordenação SHALL ser escolhida entre vencimento (padrão), contratada, gestor, unidade e valor, crescente ou decrescente.

#### Scenario: Ordenar por contratada
- **WHEN** o operador gera com 90 dias e ordenação por contratada decrescente
- **THEN** as linhas vêm em ordem alfabética decrescente de contratada

#### Scenario: Sem número de dias
- **WHEN** o operador gera o relatório com `dias` vazio
- **THEN** o filtro mostra "Informe o número de dias" e nenhuma tabela é exibida
- **AND** `GET /api/relatorios/contratos-vencendo` sem `dias` responde `400` com a mensagem no campo `dias`

### Requirement: Contratos vencidos
O sistema SHALL exibir em `/relatorios/contratos-vencidos` os contratos originais com `dataTermino` entre a data inicial e a data final, inclusive (`data_termino BETWEEN início AND fim`, docs/legado/relatorios.md, tela `vencidos`), com as mesmas colunas de Contratos vencendo, ordenados por vencimento. As duas datas SHALL ser obrigatórias e a inicial não pode ser posterior à final.

#### Scenario: Vencidos no período
- **GIVEN** contratos originais com `dataTermino` 01/10/2026, 15/10/2026 e 01/11/2026
- **WHEN** o operador gera com período de 01/10/2026 a 15/10/2026
- **THEN** aparecem os dois primeiros
- **AND** o título é "Contratos vencidos - Período de: 01/10/2026 até 15/10/2026"

#### Scenario: Período incompleto ou invertido
- **WHEN** o operador gera sem a data final, ou com a data inicial posterior à final
- **THEN** o filtro mostra "Informe a data final" ou "Data inicial posterior à data final" e nenhuma tabela é exibida
- **AND** a API responde `400` com a mensagem no campo correspondente

### Requirement: Cadastro incompleto
O sistema SHALL exibir em `/relatorios/cadastro-incompleto` os contratos originais de tipo marcado como Contrato, vigentes (`dataTermino > hoje`) e sem o PDF do contrato (`anexo` vazio) ou sem o PDF do projeto básico (`projetoBasico` vazio), com as colunas Nº processo, Nº contrato, Contratada, Objeto, Tem contrato (Sim/Não) e Tem projeto básico (Sim/Não) (docs/legado/relatorios.md, tela `cadastro`). Vazio SHALL significar nulo ou texto vazio.

#### Scenario: Falta o projeto básico
- **GIVEN** dois contratos vigentes do tipo Contrato, um com anexo e projeto básico e outro com anexo e sem projeto básico
- **WHEN** o operador abre o relatório
- **THEN** só o segundo aparece, com Tem contrato "Sim" e Tem projeto básico "Não"

#### Scenario: Contrato vencido não entra
- **GIVEN** um contrato do tipo Contrato sem anexo com `dataTermino` ontem
- **WHEN** o operador abre o relatório
- **THEN** o contrato não aparece

### Requirement: Acompanhamento de meta
O sistema SHALL exibir em `/relatorios/acompanhamento-meta`, igual ao legado (decisão do autor; docs/legado/relatorios.md, tela `meta`), três listas de contratos originais: **Total** (tipo marcado como Contrato e `dataTermino > hoje`), **Vencidos** (tipo marcado como Contrato e `dataTermino < hoje`, ordenados por contratada) e **Em prorrogação/risco** (tipo com `indicativoMetaRisco = 'S'` e vencimento em mais de 0 e até 180 dias).

#### Scenario: Três listas
- **GIVEN** um contrato do tipo Contrato vigente de `R$ 100,00`, outro do tipo Contrato vencido há 3 dias e um contrato de tipo não marcado como Contrato, com `indicativoMetaRisco = 'S'`, vencendo em 120 dias
- **WHEN** o operador abre o relatório
- **THEN** Total mostra 1 termo e `R$ 100,00`, Vencidos mostra 1 termo e Em prorrogação/risco mostra 1 termo com 120 dias para vencer

#### Scenario: Fora da janela de risco
- **GIVEN** um contrato de tipo com `indicativoMetaRisco = 'S'` vencendo em 200 dias
- **WHEN** o operador abre o relatório
- **THEN** o contrato não aparece em Em prorrogação/risco

### Requirement: Resumo e detalhe da meta
Para cada lista do Acompanhamento de meta o sistema SHALL mostrar Valor total (soma de `valorTotal` em `Decimal`) e Nº de termos (quantidade), e o detalhe com Processo, Contrato, Objeto, Contratada, Gestor, UN Gestora, Vencimento, Dias para vencer, Na Presidência (`naPresidencia = 1` → Sim, senão Não) e Valor total.

#### Scenario: Somar sem perder centavos
- **GIVEN** dois contratos vigentes do tipo Contrato de `R$ 0,10` e `R$ 0,20`
- **WHEN** o operador abre o relatório
- **THEN** Total mostra 2 termos e `R$ 0,30`

### Requirement: Acerto de valor — listar
O sistema SHALL exibir em `/relatorios/acerto-valor` os contratos originais com `valorInicial` nulo, 20 por página, ordenados por `numeroContrato`, com busca por objeto (`q`, contém) e as colunas Nº processo, Nº contrato, Objeto, UN Gestora, Contratada e Valor inicial editável (docs/legado/relatorios.md, tela `acertoValor`).

#### Scenario: Só contratos sem valor inicial
- **GIVEN** 25 contratos originais com `valorInicial` nulo, um com `valorInicial` preenchido e um aditivo com `valorInicial` nulo
- **WHEN** o operador abre o relatório
- **THEN** vê 20 contratos na primeira página e 5 na segunda, sem o preenchido e sem o aditivo

#### Scenario: Buscar por objeto
- **WHEN** o operador busca "limpeza"
- **THEN** só aparecem contratos sem valor inicial cujo objeto contém "limpeza"

### Requirement: Acerto de valor — gravar valor inicial
O sistema SHALL gravar o valor inicial informado na tela de Acerto de valor por `PUT /api/relatorios/acerto-valor/:id` com corpo `{ "valorInicial": "1.234,56" }` validado por schema estrito, convertendo para `Decimal` no servidor e alterando só `valorInicial`, e só em contrato original com `valorInicial` nulo.

#### Scenario: Gravar valor inicial
- **GIVEN** um contrato original com `valorInicial` nulo
- **WHEN** o operador digita `1.234,56` na linha e aciona *Gravar*
- **THEN** `valorInicial` passa a `1234.56` (`Decimal`), os demais campos do contrato não mudam
- **AND** a linha sai da lista

### Requirement: Acerto de valor — recusas
A gravação do valor inicial SHALL responder `400` com "Informe o valor no formato 1.234,56" para valor inválido, `404` para id inexistente ou de aditivo, `409` com "Valor inicial já informado" para contrato que já tem valor inicial, e `400` para campo fora do schema, sem gravar nada.

#### Scenario: Valor inválido
- **WHEN** o operador grava `12,3,4`
- **THEN** a linha mostra "Informe o valor no formato 1.234,56" e nada é gravado

#### Scenario: Já informado ou aditivo
- **WHEN** chega um `PUT` para um contrato que já tem `valorInicial`
- **THEN** a resposta é `409` com "Valor inicial já informado"
- **AND** um `PUT` para um aditivo responde `404`

#### Scenario: Campo extra
- **WHEN** chega um `PUT` com `{ "valorInicial": "10,00", "valorTotal": "99,00" }`
- **THEN** a resposta é `400` e nada é gravado

### Requirement: Exportação CSV
Contratos por gestor, Contratos vencendo e Contratos vencidos SHALL oferecer *Exportar CSV*, que baixa de `GET /api/relatorios/<relatorio>?<filtros>&formato=csv` as mesmas linhas e colunas da tela (substitui o Excel do legado, `criaExcel`): UTF-8 com BOM, separador `;`, linhas CRLF, cabeçalho com os rótulos das colunas, datas `dd/MM/yyyy`, valores com vírgula decimal e sem `R$`, nome `<relatorio>-AAAA-MM-DD.csv`. Célula que começa com `=`, `+`, `-`, `@`, tab ou CR SHALL ser prefixada com `'`.

#### Scenario: Baixar CSV de vencidos
- **GIVEN** um contrato vencido no período com valor total `R$ 1.234,56` e objeto `Serviço; manutenção`
- **WHEN** o operador aciona *Exportar CSV*
- **THEN** recebe `contratos-vencidos-<data>.csv` com BOM, cabeçalho `Contratada;Gestor;UN Gestora;Tipo;Contrato;Processo;Objeto;Valor total;Vencimento`, valor `1234,56` e o objeto entre aspas

#### Scenario: Fórmula neutralizada
- **GIVEN** uma contratada cuja razão social começa com `=`
- **WHEN** o CSV é gerado
- **THEN** a célula começa com `'=`

### Requirement: Impressão e PDF
Contratos por gestor, Contratos vencendo, Contratos vencidos e Acompanhamento de meta SHALL ter o botão *Imprimir / PDF*, que abre a impressão do navegador (onde o operador escolhe "Salvar como PDF").

#### Scenario: Abrir a impressão
- **WHEN** o operador aciona *Imprimir / PDF* em Contratos por gestor
- **THEN** o diálogo de impressão do navegador abre com o relatório

### Requirement: Conteúdo impresso
Na impressão de um relatório SHALL aparecer só o título do relatório (os do legado: "Contratos acumulados pelo gestor", "Contratos vencendo em N dias", "Contratos vencidos - Período de: … até …", "Acompanhamento de meta"), os filtros aplicados, "Emitido em dd/MM/yyyy" e a tabela inteira, sem menu, cabeçalho do app, filtros nem botões; vencendo e vencidos SHALL imprimir em A4 paisagem.

#### Scenario: Imprimir vencendo
- **GIVEN** o relatório de vencendo gerado com 60 dias
- **WHEN** o operador aciona *Imprimir / PDF*
- **THEN** a página impressa é A4 paisagem, com o título "Contratos vencendo em 60 dias" e todas as linhas
- **AND** o menu lateral, o cabeçalho e os filtros não aparecem

### Requirement: Relatórios exigem sessão
Páginas `/relatorios/**` e rotas `/api/relatorios/**` SHALL exigir sessão válida, como o restante do app.

#### Scenario: Sem sessão
- **WHEN** um `GET /api/relatorios/contratos-vencendo?dias=30` chega sem cookie de sessão
- **THEN** a resposta é `401` e nenhum dado de contrato é devolvido
