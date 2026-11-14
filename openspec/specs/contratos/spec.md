# contratos Specification

## Purpose
Cadastro de Contratos: a aplicação SHALL manter os contratos administrativos e seus aditivos como o sistema legado mantinha — listar com filtros, criar, editar, excluir e anexar documentos — aplicando as regras de negócio extraídas do legado.

## Requirements

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
O campo `prestadorServicoId` de Contratos SHALL ser escolhido por busca remota, por razão social ou CNPJ, entre os PrestadoresServicos (`/api/prestadores_servicos`) e gravar o id escolhido, mostrando razão social e CNPJ formatado (`##.###.###/####-##`); a chave do fornecedor no legado é `PrestadorServico.CNPJ = Contrato.prestador_servico_id`.

Mudou (022): busca remota e exibição do CNPJ.

#### Scenario: Escolher o fornecedor
- **WHEN** o operador abre o campo `prestadorServicoId`
- **THEN** vê os fornecedores e, ao escolher um, o id é gravado em `prestadorServicoId`

#### Scenario: Buscar o fornecedor pelo CNPJ
- **GIVEN** o fornecedor "Limpa Tudo Ltda" com `cnpj` `11222333000181`
- **WHEN** o operador digita `11.222.333` no campo `prestadorServicoId`
- **THEN** vê a opção "Limpa Tudo Ltda — 11.222.333/0001-81" e, ao escolhê-la e salvar, o id desse fornecedor é gravado

### Requirement: `situacaoContratualId` referencia SituacaoContratual
O campo `situacaoContratualId` de Contratos SHALL ser escolhido entre os registros de SituacaoContratual (lista de `/api/situacao_contratual`) e gravar o id do registro escolhido.

#### Scenario: Escolher a situação
- **WHEN** o operador abre o campo `situacaoContratualId`
- **THEN** vê as situações e, ao escolher uma, o id é gravado em `situacaoContratualId`

### Requirement: Gestor e suplente referenciam PessoasFisicas
Os campos `pessoaFisicaId` e `suplenteId` de Contratos SHALL ser escolhidos por busca remota, por nome ou CPF, entre as PessoasFisicas com CPF (`/api/pessoas_fisicas?comCpf=1`) e gravar o CPF escolhido com 11 dígitos, sem pontuação, como o legado (`PessoaFisica.CPF = Contrato.pessoa_fisica_id`, `docs/legado/chaves-pessoas-fornecedores.md`).

Mudou (022): grava o CPF (antes, `idPessoaFisica`) e a busca é remota.

#### Scenario: Buscar o gestor
- **WHEN** o operador digita parte do nome no campo `pessoaFisicaId`
- **THEN** vê as pessoas correspondentes e, ao escolher uma, o CPF é gravado em `pessoaFisicaId`

#### Scenario: Buscar o gestor pelo CPF
- **GIVEN** a pessoa "Maria Gestora" com `cpf` `52998224725`
- **WHEN** o operador digita `529.982.247` no campo `pessoaFisicaId`, escolhe "Maria Gestora — 529.982.247-25" e salva
- **THEN** o contrato é gravado com `pessoaFisicaId` igual a `52998224725`

### Requirement: CPF de gestor e suplente conferido pela API
A API de Contratos SHALL aceitar `pessoaFisicaId` e `suplenteId` com ou sem máscara, SHALL recusar com `400` valor sem 11 dígitos e, na criação ou quando o valor muda, SHALL recusar com `400` CPF que não existe em `pessoas_fisicas` ("Gestor não encontrado em pessoas físicas" / "Gestor suplente não encontrado em pessoas físicas"); valor inalterado na edição SHALL NOT ser reconferido.

#### Scenario: CPF com máscara pela API
- **WHEN** um `POST /api/contratos` válido chega com `suplenteId` igual a `111.444.777-35` de uma pessoa existente
- **THEN** o contrato é gravado com `suplenteId` igual a `11144477735`

#### Scenario: CPF que não existe
- **WHEN** um `POST /api/contratos` chega com `pessoaFisicaId` igual a `39053344705`, que não está em `pessoas_fisicas`
- **THEN** a resposta é `400` com `pessoaFisicaId: "Gestor não encontrado em pessoas físicas"` e nada é gravado

#### Scenario: CPF incompleto
- **WHEN** um `POST /api/contratos` chega com `suplenteId` igual a `1114447773`
- **THEN** a resposta é `400` no campo `suplenteId` e nada é gravado

#### Scenario: Gestor do legado fora da referência
- **GIVEN** um contrato carregado do legado com `pessoaFisicaId` `39053344705`, que não está em `pessoas_fisicas`
- **WHEN** o operador edita só o `objeto` e salva
- **THEN** o contrato é atualizado e `pessoaFisicaId` continua `39053344705`

### Requirement: Fornecedor inexistente recusado
A API de Contratos SHALL recusar com `400` e "Fornecedor não encontrado" um `prestadorServicoId` que não existe em `prestadores_servicos`; o obrigatório continua sendo `RK-37f294a3dc8e` ("Informe o fornecedor").

#### Scenario: Fornecedor inexistente
- **WHEN** um `POST /api/contratos` chega com `prestadorServicoId` igual a um id que não existe
- **THEN** a resposta é `400` com `prestadorServicoId: "Fornecedor não encontrado"` e nada é gravado

#### Scenario: Salvar sem fornecedor
- **WHEN** um `POST /api/contratos` chega sem `prestadorServicoId`
- **THEN** a resposta é `400` com `prestadorServicoId: "Informe o fornecedor"` (`RK-37f294a3dc8e`) e nada é gravado

### Requirement: Filtros de gestor e fornecedor por busca
Os filtros `gestor` e `prestadorServicoId` da lista `/contratos` SHALL usar o campo de busca remota; o filtro `gestor` SHALL receber o CPF (com ou sem máscara) e mostrar os contratos em que esse CPF é `pessoaFisicaId` ou `suplenteId`.

#### Scenario: Filtrar pelo gestor
- **GIVEN** o contrato FLT-A com `pessoaFisicaId` `52998224725` e o contrato FLT-B com `suplenteId` `52998224725`
- **WHEN** o operador busca "Maria" no filtro Gestor ou suplente e escolhe "Maria Gestora — 529.982.247-25"
- **THEN** a lista chama `GET /api/contratos?gestor=52998224725` e mostra FLT-A e FLT-B

#### Scenario: Filtro com CPF mascarado na URL
- **WHEN** um usuário logado chama `GET /api/contratos?gestor=529.982.247-25`
- **THEN** o resultado é o mesmo de `gestor=52998224725`

### Requirement: Detalhe do contrato com nome e documento
A página `/contratos/[id]` SHALL mostrar gestor e suplente como "<nome> — <CPF formatado>" e o fornecedor como "<razão social> — <CNPJ formatado>"; um CPF gravado que não existe em `pessoas_fisicas` SHALL aparecer formatado seguido de "(não encontrado em pessoas físicas)".

#### Scenario: Gestor encontrado
- **GIVEN** um contrato com `pessoaFisicaId` `52998224725` e fornecedor "Limpa Tudo Ltda" (`11222333000181`)
- **WHEN** o operador abre `/contratos/[id]`
- **THEN** vê "Maria Gestora — 529.982.247-25" em Gestor e "Limpa Tudo Ltda — 11.222.333/0001-81" em Fornecedor

#### Scenario: Gestor órfão
- **GIVEN** um contrato com `suplenteId` `39053344705`, que não está em `pessoas_fisicas`
- **WHEN** o operador abre `/contratos/[id]`
- **THEN** vê "390.533.447-05 (não encontrado em pessoas físicas)" em Gestor suplente

### Requirement: Conversão do gestor gravado como idPessoaFisica
A migração `022_pessoas_fornecedores` SHALL mover para `migracao_pendencias` (com `origem` `022`, contrato, campo e valor antigo) todo `pessoaFisicaId` ou `suplenteId` já gravado que não é um CPF existente em `pessoas_fisicas`, e SHALL deixar o campo nulo, sem perder o valor antigo.

#### Scenario: Migrar gestor gravado como idPessoaFisica
- **GIVEN** um contrato com `pessoaFisicaId` `"1001"` (o `idPessoaFisica` de "Maria Gestora") antes da migração
- **WHEN** a migração roda
- **THEN** o contrato fica com `pessoaFisicaId` nulo e `migracao_pendencias` tem a linha (`contratos`, id do contrato, `pessoaFisicaId`, `1001`) sem `resolvidoEm`

### Requirement: Resolvedor de gestores pendentes
O script `scripts/resolver-cpf-gestores.mjs` SHALL trocar cada pendência aberta de `origem` `022` pelo CPF da pessoa cujo `idPessoaFisica` é o valor antigo, quando essa pessoa tiver `cpf` e o campo do contrato ainda estiver nulo, e SHALL marcar a pendência com `resolvidoEm`. O script SHALL ser idempotente e, com `--dry-run`, SHALL só listar sem gravar.

#### Scenario: Resolver depois da carga
- **GIVEN** a pendência (`contratos`, contrato X, `pessoaFisicaId`, `1001`) e "Maria Gestora" (`idPessoaFisica` 1001) já com `cpf` `52998224725`
- **WHEN** o resolvedor roda
- **THEN** o contrato X fica com `pessoaFisicaId` `52998224725` e a pendência tem `resolvidoEm`

#### Scenario: Pessoa ainda sem CPF
- **GIVEN** uma pendência com valor antigo `1002` e a pessoa de `idPessoaFisica` 1002 sem `cpf`
- **WHEN** o resolvedor roda duas vezes
- **THEN** a pendência continua aberta, o contrato não muda e a saída informa 1 pendência aberta nas duas execuções

#### Scenario: Simulação
- **GIVEN** a pendência resolvível de "Maria Gestora"
- **WHEN** o resolvedor roda com `--dry-run`
- **THEN** a saída lista a troca de `1001` por `52998224725` e nem o contrato nem a pendência mudam

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
