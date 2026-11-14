# Spec Delta

## MODIFIED Requirements

### Requirement: Criar Contratos
O sistema SHALL permitir criar um contrato em `/contratos/new` com os campos na ordem descrita no cenário *Ordem dos campos*.

Alterado pela 020: entram `numeroFiscais` e `naPresidencia` (docs/legado/contratos-complementos.md) e `projetoBasico` passa a ser arquivo PDF.

#### Scenario: Salvar um contrato válido
- **WHEN** o operador preenche os campos obrigatórios e salva
- **THEN** o contrato é gravado em `contratos` e a lista o exibe

#### Scenario: Ordem dos campos
- **WHEN** o operador abre `/contratos/new`
- **THEN** vê os campos nesta ordem: `numeroProcesso`, `numeroContrato`, `tipoContratoId`, `modalidadeId`, `numeroModalidade`, `objeto`, `departamentoId`, `prestadorServicoId`, `pessoaFisicaId`, `suplenteId`, `numeroFiscais`, `naPresidencia`, `dataInicio`, `dataTermino`, `valorMensal`, `valorTotal`, `situacaoContratualId`, `projetoBasico` (arquivo PDF) e anexos
- **AND** *Número de fiscais* e *Localizado na Presidência* vêm depois do gestor suplente e *Projeto básico (PDF)* é campo de arquivo

### Requirement: Editar Contratos
O sistema SHALL permitir editar um contrato existente em `/contratos/[id]/edit`, com o formulário pré-preenchido, incluindo `numeroFiscais` e `naPresidencia`. Um campo de arquivo (`anexo`, `projetoBasico`) enviado vazio SHALL manter o arquivo já gravado.

Alterado pela 020: o formulário de edição tem os mesmos campos novos da criação e preserva os PDFs já gravados quando nenhum arquivo novo é escolhido.

#### Scenario: Alterar um contrato
- **WHEN** o operador abre um contrato da lista, altera um campo e salva
- **THEN** o contrato é atualizado e a lista reflete a alteração

#### Scenario: Editar sem trocar o projeto básico
- **GIVEN** um contrato com projeto básico em PDF gravado
- **WHEN** o operador altera o objeto e salva sem escolher arquivo em *Projeto básico (PDF)*
- **THEN** `projetoBasico` continua com o mesmo arquivo

### Requirement: Excluir Contratos
O sistema SHALL permitir excluir um contrato após confirmação explícita, respeitando os requisitos *Exclusão de contrato bloqueada por vínculos* e *Exclusão de contrato apaga anexos e arquivos*.

Alterado pela 020: antes dava `409` genérico com aditivos e deixava registros e arquivos órfãos; coordenado com a 024 (kit).

#### Scenario: Excluir com confirmação
- **GIVEN** um contrato aberto para edição, sem aditivos, pagamentos, penalidades nem prestações de contas
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o contrato é removido de `contratos` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

## ADDED Requirements

### Requirement: Exclusão de contrato bloqueada por vínculos
O sistema SHALL recusar com `409` a exclusão de contrato que tenha aditivos, pagamentos, penalidades ou prestações de contas, sem apagar nada, com a mensagem "Não é possível excluir o contrato: há <lista> vinculados. Exclua-os antes.", onde `<lista>` diz a quantidade de cada tipo existente.

#### Scenario: Contrato com aditivo e pagamento
- **GIVEN** um contrato com 2 aditivos e 1 pagamento
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** a API responde `409` com "Não é possível excluir o contrato: há 2 aditivos, 1 pagamento vinculados. Exclua-os antes."
- **AND** o formulário mostra essa mensagem e o contrato, os aditivos e o pagamento continuam gravados

#### Scenario: Contrato com prestação de contas
- **GIVEN** um contrato sem aditivos e com 1 prestação de contas
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** a API responde `409` com "Não é possível excluir o contrato: há 1 prestação de contas vinculados. Exclua-os antes." e nada é apagado

### Requirement: Exclusão de contrato apaga anexos e arquivos
Ao excluir contrato sem vínculos que bloqueiam, o sistema SHALL apagar na mesma transação o contrato e seus registros de `anexos_publicacao`, `anexos_fiscais`, `contrato_status`, `historicos` e `fiscais`, e em seguida SHALL apagar do disco os PDFs desses anexos, do contrato (`anexo`) e do projeto básico.

#### Scenario: Anexos excluídos junto
- **GIVEN** um contrato sem vínculos que bloqueiam, com PDF do contrato, projeto básico, 1 anexo de publicação, 1 anexo fiscal e 1 registro de andamento
- **WHEN** o operador exclui o contrato
- **THEN** não resta linha em `anexos_publicacao`, `anexos_fiscais` nem `contrato_status` com o `contratoId` dele
- **AND** os quatro arquivos PDF não existem mais na pasta de uploads

### Requirement: Projeto básico em PDF
O campo `projetoBasico` SHALL ser um arquivo PDF gravado por `savePdf()`, como no legado ("Projeto Básico (.pdf)", docs/legado/contratos-complementos.md). Arquivo que não é PDF SHALL ser recusado com `400` e "Erro ao incluir O arquivo anexo deve ser do tipo PDF!" no campo; texto no lugar do arquivo SHALL ser recusado com "Envie o arquivo em PDF".

#### Scenario: Enviar o projeto básico
- **WHEN** o operador escolhe um PDF em *Projeto básico (PDF)* e salva o contrato
- **THEN** `projetoBasico` guarda o nome gerado por `savePdf()`

#### Scenario: Projeto básico que não é PDF
- **WHEN** o operador envia uma imagem PNG como projeto básico e salva
- **THEN** a API responde `400`, o campo mostra "Erro ao incluir O arquivo anexo deve ser do tipo PDF!" e nada é gravado

### Requirement: Ver o projeto básico
A página `/contratos/[id]` SHALL mostrar o projeto básico na seção *Anexos* com o link *Ver PDF* para `/api/arquivos/<nome>`, que abre o arquivo em nova aba só para sessão válida, e "—" quando não houver arquivo.

#### Scenario: Contrato com projeto básico
- **GIVEN** um contrato com projeto básico gravado
- **WHEN** o operador abre a página do contrato
- **THEN** o item *Projeto básico* mostra *Ver PDF* apontando para `/api/arquivos/<projetoBasico>`

#### Scenario: Contrato sem projeto básico
- **WHEN** o operador abre a página de um contrato com `projetoBasico` vazio
- **THEN** o item *Projeto básico* mostra "—"

### Requirement: Localizado na Presidência
O formulário de contrato SHALL ter o interruptor *Localizado na Presidência*, gravado em `naPresidencia` como `1` (ligado) ou `0` (desligado), como o BOOLEAN `na_presidencia` do legado (docs/legado/contratos-complementos.md). Valor diferente de `0`/`1` SHALL ser recusado com `400`. A página do contrato SHALL mostrar "Sim" ou "Não".

#### Scenario: Marcar contrato na Presidência
- **WHEN** o operador liga *Localizado na Presidência* e salva
- **THEN** `naPresidencia` é gravado como `1` e a página do contrato mostra "Localizado na Presidência: Sim"

#### Scenario: Padrão desligado
- **WHEN** o operador cria um contrato sem mexer no interruptor
- **THEN** `naPresidencia` é gravado como `0`

### Requirement: Número de fiscais
O formulário de contrato SHALL ter o campo opcional *Número de fiscais* (`numeroFiscais`, docs/legado/contratos-complementos.md), que aceita só um inteiro de 0 a 999; outro valor SHALL ser recusado com `400` e a mensagem "Número de fiscais inválido". A página do contrato SHALL mostrar o valor.

#### Scenario: Informar o número de fiscais
- **WHEN** o operador informa `3` em *Número de fiscais* e salva
- **THEN** `numeroFiscais` é gravado como `3` e a página do contrato mostra "Número de fiscais: 3"

#### Scenario: Valor inválido
- **WHEN** o operador envia `abc` em `numeroFiscais`
- **THEN** a API responde `400` com "Número de fiscais inválido" no campo

### Requirement: Tamanhos máximos do legado
O sistema SHALL recusar com `400` a gravação de contrato (criação, edição) cujo `numeroProcesso` ou `numeroContrato` passe de 45 caracteres, `objeto` passe de 200 ou `numeroModalidade` passe de 12, contados depois de remover espaços das pontas, com a mensagem "<campo> deve ter no máximo <n> caracteres" no campo. O formulário SHALL impedir digitar além desses limites. Origem: limites das telas do legado (docs/legado/rk-conferencia.md, divergência registrada; sem chave RK).

#### Scenario: Número do processo com 46 caracteres
- **WHEN** o operador salva um contrato com `numeroProcesso` de 46 caracteres
- **THEN** a API responde `400` com "Nº do processo deve ter no máximo 45 caracteres" no campo e nada é gravado

#### Scenario: Objeto no limite
- **WHEN** o operador salva um contrato com `objeto` de exatamente 200 caracteres
- **THEN** o contrato é gravado

#### Scenario: Limite no formulário
- **WHEN** o operador abre `/contratos/new`
- **THEN** os campos *Nº do processo* e *Nº do contrato* têm `maxlength` 45, *Objeto* 200 e *Nº da modalidade* 12

### Requirement: Imprimir a página do contrato
A página `/contratos/[id]` SHALL ter o botão *Imprimir*, que abre a impressão do navegador com uma folha de estilo de impressão: menu lateral, cabeçalho do app, botões e formulário de andamento SHALL ficar ocultos e todas as seções do contrato SHALL ser impressas. Origem: ação PRINT de `contratos/visualizar` (docs/legado/contratos-complementos.md).

#### Scenario: Imprimir um contrato
- **GIVEN** o operador na página de um contrato
- **WHEN** aciona *Imprimir*
- **THEN** a pré-visualização mostra identificação, partes, vigência e valores, aditivos, anexos e andamento
- **AND** não mostra o menu lateral, o cabeçalho do app, os botões nem o formulário de andamento

### Requirement: Cabeçalho de impressão
A impressão da página do contrato SHALL começar com "DETRAN-RJ — Contrato nº <numeroContrato>" e "Impresso em dd/MM/yyyy HH:mm por <usuário da sessão>"; esse cabeçalho SHALL NOT aparecer na tela.

#### Scenario: Cabeçalho na folha impressa
- **GIVEN** o usuário `maria` na página do contrato `001/2026`
- **WHEN** aciona *Imprimir*
- **THEN** a folha começa com "DETRAN-RJ — Contrato nº 001/2026" e "Impresso em <data e hora atuais> por maria"
- **AND** na tela esse cabeçalho não aparece

### Requirement: Registrar andamento do contrato
A página `/contratos/[id]` SHALL ter a seção *Andamento* com status (de `/api/status`), descrição e *Atendido*, gravando em `contrato_status` o `contratoId` da página, a data do servidor e o usuário da sessão, como `contratos/fluxo` do legado (docs/legado/contratos-complementos.md). O status SHALL ser obrigatório (`RK-a7017eb6c42d`, `RK-067d06861847`) e a descrição SHALL passar por `RK-f0ce91a53de9`.

#### Scenario: Registrar um andamento
- **WHEN** o operador escolhe o status "Em análise", escreve "Enviado ao jurídico", liga *Atendido* e aciona *Registrar andamento*
- **THEN** um registro de `contrato_status` é gravado com o `contratoId` da página, `statusId` de "Em análise", `atendido = 1`, a data do servidor e o usuário da sessão
- **AND** o registro aparece no topo da linha do tempo sem recarregar a página manualmente

#### Scenario: Andamento sem status
- **WHEN** o operador aciona *Registrar andamento* sem escolher status
- **THEN** a API responde `400`, o campo *Status* mostra "Status é obrigatório" e nada é gravado

### Requirement: Linha do tempo do andamento
A seção *Andamento* da página `/contratos/[id]` SHALL listar os registros de `contrato_status` daquele contrato, do mais recente para o mais antigo, cada um com data e hora (`dd/MM/yyyy HH:mm`), nome do status, *Atendido* ou *Pendente*, descrição e usuário que registrou. Sem registros, SHALL mostrar "Nenhum andamento registrado."

#### Scenario: Ver a linha do tempo
- **GIVEN** um contrato com andamentos registrados em 01/10/2026 e 05/10/2026
- **WHEN** o operador abre a página do contrato
- **THEN** a seção *Andamento* mostra primeiro o de 05/10/2026 e depois o de 01/10/2026, cada um com status, situação, descrição e usuário
- **AND** andamentos de outros contratos não aparecem

#### Scenario: Contrato sem andamento
- **WHEN** o operador abre a página de um contrato sem registros em `contrato_status`
- **THEN** a seção *Andamento* mostra "Nenhum andamento registrado."

### Requirement: Vigência pela data do próprio contrato
O selo de vigência da página `/contratos/[id]` (a iniciar, vigente, vence em N dias, vence hoje, vencido) e o texto "Vigência <início> a <fim>" SHALL usar só `dataInicio` e `dataTermino` do próprio registro, nunca a data de um aditivo (decisão do autor de 13/11/2026). Aditivos SHALL manter as próprias datas, na tabela de aditivos e na página do aditivo.

Substitui o comportamento da 017, que usava o maior vencimento entre o contrato e seus aditivos.

#### Scenario: Contrato vencido com aditivo posterior
- **GIVEN** um contrato com `dataTermino` 10 dias atrás e um aditivo com `dataTermino` daqui a 200 dias
- **WHEN** o operador abre a página do contrato
- **THEN** o selo mostra "Vencido em <dataTermino do contrato>" e o texto de vigência termina na `dataTermino` do contrato
- **AND** não aparece "Vencimento com aditivos"

### Requirement: Painel Início pela data do próprio contrato
O painel Início (`/`) SHALL listar em "Vencendo nos próximos 30 dias" e "Vencidos" só contratos originais (`parentId` vazio), classificados pela `dataTermino` do próprio contrato, nunca pela de um aditivo (decisão do autor de 13/11/2026).

#### Scenario: Painel Início ignora o aditivo
- **GIVEN** um contrato com `dataTermino` 10 dias atrás e um aditivo com `dataTermino` daqui a 200 dias
- **WHEN** o operador abre `/`
- **THEN** o contrato aparece em "Vencidos" com "Há 10 dias" e não em "Vencendo nos próximos 30 dias"

#### Scenario: Contrato vencendo com aditivo
- **GIVEN** um contrato com `dataTermino` daqui a 20 dias e um aditivo com `dataTermino` daqui a 400 dias
- **WHEN** o operador abre `/`
- **THEN** o contrato aparece em "Vencendo nos próximos 30 dias" com "Em 20 dias"
