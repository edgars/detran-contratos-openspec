# Spec Delta

## Purpose

Cadastro de Contratos: a aplicação SHALL manter os contratos administrativos e seus aditivos como o sistema legado mantinha — listar com filtros, criar, editar, excluir e anexar documentos — aplicando as regras de negócio extraídas do legado.

## ADDED Requirements

### Requirement: Listar Contratos
O sistema SHALL exibir em `/contratos` uma lista paginada de Contratos com as colunas `numeroContrato`, `numeroProcesso`, `objeto`, unidade gestora, fornecedor, `dataTermino`, `valorTotal` e situação contratual.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/contratos`
- **THEN** vê a tabela com essas colunas, paginada, com datas em `dd/MM/yyyy` e valores em `R$`

### Requirement: Filtrar Contratos
O sistema SHALL filtrar a lista por texto (`numeroProcesso`, `numeroContrato` ou `objeto`), unidade gestora, fornecedor, gestor, situação contratual e vencimento nos próximos N dias, e ordenar por `dataTermino`, `numeroContrato` ou `valorTotal`.

#### Scenario: Contratos vencendo
- **GIVEN** um contrato com `dataTermino` daqui a 10 dias e outro daqui a 60 dias
- **WHEN** o operador filtra por vencimento nos próximos 30 dias
- **THEN** a lista mostra só o primeiro

### Requirement: Criar Contratos
O sistema SHALL permitir criar um contrato em `/contratos/new` com os campos, nesta ordem: `numeroProcesso`, `numeroContrato`, `tipoContratoId`, `modalidadeId`, `numeroModalidade`, `objeto`, `departamentoId`, `prestadorServicoId`, `pessoaFisicaId`, `suplenteId`, `dataInicio`, `dataTermino`, `valorMensal`, `valorTotal`, `situacaoContratualId`, `projetoBasico` e anexos.

#### Scenario: Salvar um contrato válido
- **WHEN** o operador preenche os campos obrigatórios e salva
- **THEN** o contrato é gravado em `contratos` e a lista o exibe

### Requirement: Editar Contratos
O sistema SHALL permitir editar um contrato existente em `/contratos/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um contrato
- **WHEN** o operador abre um contrato da lista, altera um campo e salva
- **THEN** o contrato é atualizado e a lista reflete a alteração

### Requirement: Excluir Contratos
O sistema SHALL permitir excluir um contrato após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um contrato aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o contrato é removido de `contratos` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Informe o tipo de contrato
O sistema SHALL aplicar a regra `RK-79134600b4be`: rejeitar a gravação de um contrato sem `tipoContratoId`, com a mensagem "Informe o tipo de contrato".

#### Scenario: Salvar sem tipo
- **WHEN** o operador salva um contrato com `tipoContratoId` vazio
- **THEN** o formulário mostra "Informe o tipo de contrato" no campo e a API responde `400`

### Requirement: Informe o número do processo
O sistema SHALL aplicar a regra `RK-776d8b62d6df`: rejeitar a gravação de um contrato sem `numeroProcesso`, com a mensagem "Informe o número do processo".

#### Scenario: Salvar sem número do processo
- **WHEN** o operador salva um contrato com `numeroProcesso` vazio
- **THEN** o formulário mostra "Informe o número do processo" no campo e a API responde `400`

### Requirement: Informe o número do contrato
O sistema SHALL aplicar a regra `RK-04fd1cbfc346`: rejeitar a gravação de um contrato sem `numeroContrato`, com a mensagem "Informe o número do contrato".

#### Scenario: Salvar sem número do contrato
- **WHEN** o operador salva um contrato com `numeroContrato` vazio
- **THEN** o formulário mostra "Informe o número do contrato" no campo e a API responde `400`

### Requirement: Informe a data de início
O sistema SHALL aplicar a regra `RK-6b2806cfff8d`: rejeitar a gravação de um contrato sem `dataInicio`, com a mensagem "Informe a data de início".

#### Scenario: Salvar sem data de início
- **WHEN** o operador salva um contrato com `dataInicio` vazia
- **THEN** o formulário mostra "Informe a data de início" no campo e a API responde `400`

### Requirement: Informe a data de vencimento
O sistema SHALL aplicar a regra `RK-9d6599f5897d`: rejeitar a gravação de um contrato sem `dataTermino`, com a mensagem "Informe a data de vencimento".

#### Scenario: Salvar sem data de vencimento
- **WHEN** o operador salva um contrato com `dataTermino` vazia
- **THEN** o formulário mostra "Informe a data de vencimento" no campo e a API responde `400`

### Requirement: Informe a unidade gestora
O sistema SHALL aplicar a regra `RK-a0660a4fb262`: rejeitar a gravação de um contrato sem `departamentoId`, com a mensagem "Informe o departamento(unidade gestora)".

#### Scenario: Salvar sem unidade gestora
- **WHEN** o operador salva um contrato com `departamentoId` vazio
- **THEN** o formulário mostra "Informe o departamento(unidade gestora)" no campo e a API responde `400`

### Requirement: Informe o fornecedor
O sistema SHALL aplicar a regra `RK-37f294a3dc8e`: rejeitar a gravação de um contrato sem `prestadorServicoId`, com a mensagem "Informe o fornecedor".

#### Scenario: Salvar sem fornecedor
- **WHEN** o operador salva um contrato com `prestadorServicoId` vazio
- **THEN** o formulário mostra "Informe o fornecedor" no campo e a API responde `400`

### Requirement: Valores convertidos antes de gravar
O sistema SHALL aplicar as regras `RK-5c46553fce3d` e `RK-260f6b933f77`: converter `valorTotal` e `valorMensal` digitados em formato brasileiro (`1.234,56`) para `Decimal` antes de gravar.

#### Scenario: Valor em formato brasileiro
- **WHEN** o operador digita `1.234,56` em `valorTotal` e salva
- **THEN** o valor gravado é `1234.56` e a lista exibe `R$ 1.234,56`

### Requirement: Valor inicial do contrato original
O sistema SHALL aplicar a regra `RK-c3fbde6dbf4a`: quando o contrato não tem `parentId`, gravar `valorInicial` igual a `valorTotal`; num aditivo, `valorInicial` SHALL NOT ser recalculado.

#### Scenario: Contrato original
- **WHEN** o operador cria um contrato sem `parentId` com `valorTotal` de `R$ 120.000,00`
- **THEN** `valorInicial` é gravado como `120000.00`

#### Scenario: Aditivo
- **GIVEN** um contrato original com `valorInicial` de `R$ 120.000,00`
- **WHEN** o operador cria um aditivo com `valorTotal` de `R$ 30.000,00`
- **THEN** o original mantém `valorInicial` de `R$ 120.000,00`

### Requirement: Aditivo de contrato
O sistema SHALL permitir criar um aditivo em `/contratos/[id]/aditivos/new`, gravando um contrato com `parentId` igual ao contrato original e copiando dele tipo, objeto, unidade gestora e fornecedor.

#### Scenario: Criar aditivo
- **WHEN** o operador abre um contrato e aciona *Novo aditivo*, informa vigência e valores e salva
- **THEN** um contrato com `parentId` do original é gravado e aparece na página do contrato original

### Requirement: Anexos do cadastro só em PDF
O sistema SHALL aplicar as regras `RK-295d296eb4f7` e `RK-b6f82ba63c1f`: os anexos de publicação e de fiscalização enviados no cadastro do contrato SHALL ser PDF, conferido por `savePdf()`, e são gravados em `anexos_publicacao` e `anexos_fiscais`.

#### Scenario: Anexo que não é PDF
- **WHEN** o operador envia uma planilha como anexo de publicação e salva
- **THEN** o formulário mostra "Erro ao incluir O arquivo anexo deve ser do tipo PDF!" e nada é gravado

### Requirement: `tipoContratoId` referencia TipoContrato
O campo `tipoContratoId` de Contratos SHALL ser escolhido entre os registros de TipoContrato (lista de `/api/tipo_contratos`) e gravar o id do registro escolhido.

#### Scenario: Escolher um tipo
- **WHEN** o operador abre o campo `tipoContratoId`
- **THEN** vê os registros de TipoContrato e, ao escolher um, o id é gravado em `tipoContratoId`

### Requirement: `modalidadeId` referencia Modalidades
O campo `modalidadeId` de Contratos SHALL ser escolhido entre os registros de Modalidades (lista de `/api/modalidades`) e gravar o id do registro escolhido.

#### Scenario: Escolher uma modalidade
- **WHEN** o operador abre o campo `modalidadeId`
- **THEN** vê os registros de Modalidades e, ao escolher um, o id é gravado em `modalidadeId`

### Requirement: `departamentoId` referencia Departamentos
O campo `departamentoId` de Contratos SHALL ser escolhido entre os registros de Departamentos (lista de `/api/departamentos`) e gravar o id do registro escolhido.

#### Scenario: Escolher a unidade gestora
- **WHEN** o operador abre o campo `departamentoId`
- **THEN** vê os departamentos e, ao escolher um, o id é gravado em `departamentoId`

### Requirement: `prestadorServicoId` referencia PrestadoresServicos
O campo `prestadorServicoId` de Contratos SHALL ser escolhido entre os registros de PrestadoresServicos (lista de `/api/prestadores_servicos`) e gravar o id do registro escolhido.

#### Scenario: Escolher o fornecedor
- **WHEN** o operador abre o campo `prestadorServicoId`
- **THEN** vê os fornecedores e, ao escolher um, o id é gravado em `prestadorServicoId`

### Requirement: `situacaoContratualId` referencia SituacaoContratual
O campo `situacaoContratualId` de Contratos SHALL ser escolhido entre os registros de SituacaoContratual (lista de `/api/situacao_contratual`) e gravar o id do registro escolhido.

#### Scenario: Escolher a situação
- **WHEN** o operador abre o campo `situacaoContratualId`
- **THEN** vê as situações e, ao escolher uma, o id é gravado em `situacaoContratualId`

### Requirement: Gestor e suplente referenciam PessoasFisicas
Os campos `pessoaFisicaId` e `suplenteId` de Contratos SHALL ser escolhidos por busca entre os registros de PessoasFisicas (lista de `/api/pessoas_fisicas`) e gravar o CPF do registro escolhido.

#### Scenario: Buscar o gestor
- **WHEN** o operador digita parte do nome no campo `pessoaFisicaId`
- **THEN** vê as pessoas correspondentes e, ao escolher uma, o CPF é gravado em `pessoaFisicaId`
