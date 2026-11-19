# prestacao-contas Specification

## Purpose
Cadastro de PrestacaoContas: a aplicação SHALL manter os registros de `prestacao_contas` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Contratos sujeitos à prestação de contas
O sistema SHALL considerar sujeito à prestação de contas o contrato original (`parentId` nulo) de tipo marcado com `prestacaoContas = "S"`, vencido pela própria `dataTermino` (anterior a hoje; aditivos não contam) e com `valorTotal` maior que R$ 650.000,00, constante única `PRESTACAO_VALOR_MINIMO` (legado: tela `prestacao`, `docs/legado/prestacao-contas.md`; sem chave `RK-…` conhecida).

#### Scenario: Contrato que atende a todos os critérios
- **GIVEN** um contrato original de tipo marcado, `dataTermino` ontem e `valorTotal` R$ 700.000,00
- **WHEN** o operador abre `/prestacao_contas`
- **THEN** o contrato aparece na aba Pendentes

#### Scenario: Limite de valor é estrito
- **GIVEN** dois contratos originais vencidos de tipo marcado, um com `valorTotal` R$ 650.000,00 e outro com R$ 650.000,01
- **WHEN** a lista é carregada
- **THEN** só o de R$ 650.000,01 aparece

#### Scenario: Tipo não marcado, aditivo ou contrato vigente ficam de fora
- **GIVEN** um contrato vencido acima do limite de tipo com `prestacaoContas = "N"`, um aditivo vencido acima do limite de tipo marcado e um contrato original de tipo marcado acima do limite com `dataTermino` hoje
- **WHEN** a lista é carregada
- **THEN** nenhum dos três aparece

#### Scenario: Aditivo não prorroga o vencimento
- **GIVEN** um contrato original de tipo marcado, acima do limite, com `dataTermino` no mês passado, e um aditivo dele com `dataTermino` no ano que vem
- **WHEN** a lista é carregada
- **THEN** o contrato original aparece como vencido

### Requirement: Lista de prestação de contas pendentes e realizadas
O sistema SHALL exibir em `/prestacao_contas` os contratos sujeitos à prestação de contas nas abas Pendentes (`prestacaoRealizada` nulo ou diferente de "1") e Realizadas (`= "1"`), parâmetro `situacao` e nunca coluna, 10 por página, sem botão *Novo*, com as colunas do legado: Nº processo, Nº contrato (link para o fluxo), Vencimento, Objeto, Dias desde o vencimento, Valor total, Contratada e UN gestora.

#### Scenario: Alternar entre pendentes e realizadas
- **GIVEN** dois contratos sujeitos à prestação de contas, um com `prestacaoRealizada` nulo e outro com "1"
- **WHEN** o operador abre a aba Pendentes e depois a aba Realizadas
- **THEN** a primeira mostra só o contrato com `prestacaoRealizada` nulo e a segunda só o contrato com "1"

#### Scenario: Colunas, dias e paginação
- **GIVEN** 12 contratos pendentes, um deles com `dataTermino` 15 dias antes de hoje
- **WHEN** o operador abre a aba Pendentes
- **THEN** a primeira página mostra 10 contratos e a segunda 2
- **AND** a linha desse contrato mostra 15 na coluna Dias, a data em `dd/MM/yyyy` e o valor em `R$`

### Requirement: Busca por coluna na prestação de contas
O sistema SHALL permitir buscar, na lista de prestação de contas, um texto (`q`) dentro de uma coluna escolhida (`campo`): UN gestora, Gestor, Contratada, Nº contrato, Nº processo ou Objeto, como a tela `prestacao` do legado. `campo` e `q` MUST ser parâmetros da lista, nunca colunas; `campo` fora da lista MUST gerar `400` com erro no campo.

#### Scenario: Buscar pela contratada
- **GIVEN** dois contratos pendentes, de contratadas "Alfa Serviços" e "Beta Obras"
- **WHEN** o operador escolhe a coluna Contratada e busca "alfa"
- **THEN** a lista mostra só o contrato da "Alfa Serviços"

#### Scenario: Buscar pelo gestor
- **GIVEN** um contrato pendente cujo gestor se chama "Maria Souza" e outro cujo gestor se chama "João Lima"
- **WHEN** o operador escolhe a coluna Gestor e busca "souza"
- **THEN** a lista mostra só o contrato do gestor "Maria Souza"

#### Scenario: Coluna de busca inválida
- **WHEN** a API recebe `GET /api/prestacao_contas/contratos?campo=senha&q=x`
- **THEN** responde `400` com erro no campo `campo`

### Requirement: Ordenação da prestação de contas
O sistema SHALL ordenar a lista de prestação de contas por Contratada, Vencimento, Valor, UN gestora ou Gestor, em ordem crescente ou decrescente, como a tela `prestacao` do legado; sem escolha, MUST ordenar por Vencimento crescente. Ordenação desconhecida MUST cair no padrão, sem erro.

#### Scenario: Ordenar por valor decrescente
- **GIVEN** três contratos pendentes com valores R$ 700.000,00, R$ 900.000,00 e R$ 800.000,00
- **WHEN** o operador ordena por Valor decrescente
- **THEN** a lista mostra 900.000,00, 800.000,00 e 700.000,00, nessa ordem

#### Scenario: Ordenar por gestor
- **GIVEN** contratos pendentes com gestores "Carlos", "Ana" e sem gestor
- **WHEN** o operador ordena por Gestor crescente
- **THEN** a lista mostra o de "Ana", o de "Carlos" e por último o sem gestor

### Requirement: Filtros de tipo e modalidade na prestação de contas
O sistema SHALL filtrar a lista de prestação de contas por tipo de contrato (só tipos marcados com `prestacaoContas = "S"` aparecem no filtro) e por modalidade, como parâmetros da lista (`tipoContratoId`, `modalidadeId`), combináveis com a aba, a busca e a ordenação.

#### Scenario: Filtrar por modalidade
- **GIVEN** dois contratos pendentes, um de modalidade "Pregão" e outro de "Concorrência"
- **WHEN** o operador filtra por "Pregão"
- **THEN** a lista mostra só o contrato de "Pregão"

#### Scenario: Filtro de tipo só oferece tipos marcados
- **GIVEN** os tipos "Contrato" (`prestacaoContas = "S"`) e "Convênio" (`prestacaoContas = "N"`)
- **WHEN** o operador abre o filtro de tipo
- **THEN** só "Contrato" é oferecido

### Requirement: Painel do contrato no fluxo de prestação de contas
O sistema SHALL exibir em `/prestacao_contas/[contratoId]` um painel do contrato com Nº processo, Nº contrato, contratada, UN gestora, tipo, vencimento, valor total, situação (Pendente ou Realizada), dias desde o vencimento e meses desde o início, calculados como no legado: dias entre a `dataTermino` e hoje, em datas de calendário; meses como `PERIOD_DIFF(hoje, dataInicio)` (diferença de ano×12 + mês, ignorando o dia). Contrato inexistente MUST responder `404`.

#### Scenario: Dias e meses do painel
- **GIVEN** hoje é 13/11/2026 e um contrato com `dataInicio` 28/02/2025 e `dataTermino` 03/11/2026
- **WHEN** o operador abre o fluxo do contrato
- **THEN** o painel mostra 10 dias desde o vencimento e 21 meses desde o início

#### Scenario: Contrato inexistente
- **WHEN** a API recebe `GET /api/prestacao_contas/contratos/999999`
- **THEN** responde `404`

### Requirement: Fases do prazo no fluxo de prestação de contas
O sistema SHALL oferecer no fluxo a escolha do prazo entre os valores distintos de `fases.periodo` e listar as fases cujo `periodo` é o prazo escolhido, cada uma com a descrição e o "atendido" do último registro gravado para aquele contrato e fase (vazios se não houver), como a tela `fluxo` do legado. Sem escolha, MUST valer o primeiro prazo em ordem numérica. O prazo escolhido MUST ficar só na tela (parâmetro `periodo`), sem gravar no contrato.

#### Scenario: Escolher o prazo
- **GIVEN** as fases "Entrega do relatório" e "Análise" com período "30" e a fase "Abertura" com período "10"
- **WHEN** o operador escolhe o prazo "30" no fluxo de um contrato
- **THEN** a tela lista "Entrega do relatório" e "Análise" e não lista "Abertura"

#### Scenario: Última descrição por fase
- **GIVEN** a fase "Análise" já gravada duas vezes para o contrato, a última com descrição "Documentos completos" e atendido "S"
- **WHEN** o operador abre o fluxo no prazo da fase
- **THEN** a linha "Análise" mostra "Documentos completos" e o atendido ligado

### Requirement: Gravar fase do fluxo de prestação de contas
O sistema SHALL gravar uma fase do fluxo criando um registro novo em `prestacao_contas` com fase, contrato, descrição e atendido ("S"/"N"), validados por schema `zod` estrito, como `manterPrestacao` do legado. `userId` MUST ser o usuário da sessão e `dataInclusao` a data do servidor; valores desses campos enviados pelo cliente MUST ser descartados. Fase ou contrato inexistente MUST gerar `400` no campo.

#### Scenario: Gravar fase com autoria da sessão
- **GIVEN** o usuário "fiscal.a" logado
- **WHEN** ele grava a fase "Análise" de um contrato com descrição "Em análise", atendido "N" e `userId` de outro usuário no corpo
- **THEN** um registro novo é criado em `prestacao_contas` com `userId` de "fiscal.a" e `dataInclusao` de hoje
- **AND** o histórico do fluxo mostra o registro

#### Scenario: Campo desconhecido
- **WHEN** a API recebe `POST /api/prestacao_contas` com um campo fora do schema
- **THEN** responde `400` e nada é gravado

#### Scenario: Fase inexistente
- **WHEN** a API recebe `POST /api/prestacao_contas` com `faseId` que não existe
- **THEN** responde `400` com erro em `faseId` e nada é gravado

### Requirement: Conclusão da prestação de contas
O sistema SHALL marcar o contrato como prestação realizada (`contratos.prestacaoRealizada = "1"`) quando a fase gravada tiver `periodo` "30" (texto aparado) e atendido "S", na mesma transação da gravação, como o legado (`periodo == 30` e `atendido == 1` → `prestacao_realizada = 1`). Gravar qualquer outra combinação MUST NOT alterar `prestacaoRealizada`, e nenhuma gravação do fluxo MUST voltar o contrato a pendente.

#### Scenario: Fase de período 30 atendida conclui
- **GIVEN** um contrato pendente e a fase "Encerramento" com período "30"
- **WHEN** o operador grava "Encerramento" com atendido "S"
- **THEN** `prestacaoRealizada` do contrato passa a "1"
- **AND** o contrato sai da aba Pendentes e aparece na aba Realizadas

#### Scenario: Fase de período 30 não atendida não conclui
- **GIVEN** um contrato pendente e a fase "Encerramento" com período "30"
- **WHEN** o operador grava "Encerramento" com atendido "N"
- **THEN** `prestacaoRealizada` do contrato não muda

#### Scenario: Outro período atendido não conclui
- **GIVEN** um contrato pendente e a fase "Abertura" com período "10"
- **WHEN** o operador grava "Abertura" com atendido "S"
- **THEN** `prestacaoRealizada` do contrato não muda

#### Scenario: Conclusão não é desfeita
- **GIVEN** um contrato com `prestacaoRealizada = "1"`
- **WHEN** o operador grava a fase de período "30" com atendido "N"
- **THEN** `prestacaoRealizada` continua "1"

### Requirement: Histórico da prestação de contas somente leitura
O sistema SHALL exibir no fluxo, somente leitura, todos os registros de `prestacao_contas` do contrato (data `dd/MM/yyyy`, fase, descrição, atendido Sim/Não e usuário), do mais recente para o mais antigo. `GET /api/prestacao_contas` MUST aceitar o filtro `contratoId`; `PUT` e `DELETE` em `/api/prestacao_contas/:id` MUST NOT existir (resposta `405`), e as páginas `/prestacao_contas/new` e `/prestacao_contas/[id]/edit` MUST NOT existir. A resposta MUST NOT trazer campo de senha do usuário.

#### Scenario: Histórico do contrato
- **GIVEN** três registros gravados para o contrato A e um para o contrato B
- **WHEN** a API recebe `GET /api/prestacao_contas?contratoId=<A>`
- **THEN** devolve só os três registros do contrato A

#### Scenario: Registro gravado não é editado nem excluído
- **WHEN** a API recebe `PUT` ou `DELETE` em `/api/prestacao_contas/:id` de um registro existente
- **THEN** responde `405` e o registro não muda
