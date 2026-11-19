# Spec Delta

## Purpose

Kit de CRUD: as rotas `/api/<entidade>` e as telas de lista e formulário geradas pelo kit (`src/lib/crud/server.ts`, `src/components/crud/*`) SHALL se comportar do mesmo jeito em toda entidade — anexos sem sobra no disco, erros no campo certo, ganchos de gravação e exclusão, busca, ordenação e campos opcionais apagáveis.

## ADDED Requirements

### Requirement: Anexos desfeitos quando a gravação falha
O kit SHALL apagar do disco todo PDF gravado durante uma requisição de criação ou edição quando essa requisição não terminar com o registro gravado no banco — por erro de validação, erro de regra (`FieldRuleError`), falha de outro anexo da mesma requisição, conflito do banco (`P2002`, `P2003`) ou exceção.

#### Scenario: Validação falha depois do upload
- **GIVEN** a pasta `UPLOAD_DIR` com N arquivos
- **WHEN** um `POST /api/anexos_fiscais` chega com um PDF válido em `anexo` e `contratoId` vazio
- **THEN** a resposta é `400` com erro em `contratoId`
- **AND** `UPLOAD_DIR` continua com N arquivos

#### Scenario: Segundo anexo inválido na mesma requisição
- **GIVEN** a pasta `UPLOAD_DIR` com N arquivos
- **WHEN** um `POST /api/contratos` válido chega com um PDF em `anexo` e uma imagem PNG em `anexoPublicacao`
- **THEN** a resposta é `400` com "Erro ao incluir O arquivo anexo deve ser do tipo PDF!" em `anexoPublicacao`
- **AND** nenhum contrato é gravado e `UPLOAD_DIR` continua com N arquivos

#### Scenario: Erro do banco depois do upload
- **WHEN** a gravação no banco de um registro com PDF válido falha com `P2003`
- **THEN** a resposta é `409` e o PDF enviado não fica em `UPLOAD_DIR`

### Requirement: Troca de anexo remove o arquivo anterior
O kit SHALL apagar o PDF anterior de um campo de anexo depois que a edição que o substituiu for gravada no banco, e SHALL manter o PDF anterior quando a edição falhar.

#### Scenario: Trocar o PDF de um anexo fiscal
- **GIVEN** um anexo fiscal gravado com o arquivo `a.pdf`
- **WHEN** o operador edita o registro enviando um novo PDF e a gravação termina
- **THEN** a coluna `anexo` aponta para o novo arquivo e `a.pdf` não existe mais em `UPLOAD_DIR`

#### Scenario: Edição sem arquivo novo
- **GIVEN** um anexo fiscal gravado com o arquivo `a.pdf`
- **WHEN** o operador edita o registro sem enviar arquivo
- **THEN** a coluna `anexo` continua `a.pdf` e o arquivo continua em `UPLOAD_DIR`

#### Scenario: Edição que falha não perde o anexo
- **GIVEN** um anexo fiscal gravado com o arquivo `a.pdf`
- **WHEN** o operador envia um novo PDF com `contratoId` de um contrato inexistente
- **THEN** a resposta é `400`, `a.pdf` continua em `UPLOAD_DIR` e o novo arquivo não fica no disco

### Requirement: Exclusão com gancho e sem anexos órfãos
O kit SHALL executar a exclusão numa transação que chama o gancho `beforeDelete` da entidade (com o registro atual) antes de apagar, SHALL responder `409` com a mensagem do gancho quando ele recusar a exclusão, e SHALL apagar do disco, depois da transação confirmada, os PDFs referenciados pelo registro excluído.

#### Scenario: Excluir um anexo de publicação
- **GIVEN** um anexo de publicação gravado com o arquivo `p.pdf`
- **WHEN** o operador o exclui
- **THEN** a linha é removida e `p.pdf` não existe mais em `UPLOAD_DIR`

#### Scenario: Gancho recusa a exclusão
- **GIVEN** um Status usado por um registro de `contrato_status`
- **WHEN** o operador tenta excluir esse Status
- **THEN** a resposta é `409` e o Status continua gravado


### Requirement: Erro de upload no campo
O kit SHALL devolver o erro de um upload recusado como `400 { errors: { <campo>: <mensagem> } }`, com o nome do campo do anexo, para que o formulário mostre o erro inline nesse campo.

#### Scenario: PDF inválido em penalidade
- **WHEN** um `POST /api/penalidades` chega com uma imagem PNG em `arquivo`
- **THEN** a resposta é `400` com `errors.arquivo` = "Erro ao incluir O arquivo anexo deve ser do tipo PDF!" (`RK-174d58601890`)
- **AND** a resposta não tem `errors._`

#### Scenario: Arquivo ausente na inclusão
- **WHEN** um `POST /api/anexos_publicacaos` chega sem arquivo em `anexo`
- **THEN** a resposta é `400` com `errors.anexo` = "Erro ao incluir Não existe arquivo para anexar!" (`RK-e2b53b79c3c2`)

### Requirement: Registro atual disponível no prepare
O kit SHALL passar ao gancho `prepare` da entidade, na edição, o registro atual lido do banco (`current`), e SHALL ler esse registro uma única vez por requisição.

#### Scenario: Prepare na edição
- **GIVEN** uma entidade com `prepare` e um registro existente
- **WHEN** um `PUT /api/<entidade>/:id` é processado
- **THEN** o `prepare` recebe `current` igual ao registro gravado
- **AND** o delegate recebe uma única chamada de `findUnique` na requisição

### Requirement: Filtro de lista assíncrono
O kit SHALL aceitar um `listWhere` assíncrono, que recebe os parâmetros da lista, o usuário da sessão e o texto de busca `q`, e SHALL NOT depender de parâmetros internos montados pela rota.

#### Scenario: Buscar históricos pelo número do contrato
- **GIVEN** um histórico do contrato `123/2026` e outro de outro contrato
- **WHEN** o operador busca `123/2026` em `/historicos`
- **THEN** a lista mostra só o histórico do contrato `123/2026`

#### Scenario: Parâmetro interno forjado
- **WHEN** um cliente chama `GET /api/historicos?_q=x&_contratos=1,2,3`
- **THEN** os parâmetros `_q` e `_contratos` são ignorados e a lista é a mesma de `GET /api/historicos`

### Requirement: Busca em colunas numéricas
O kit SHALL aplicar a busca `q` às colunas de texto com `contains` e às colunas numéricas declaradas como `int` por igualdade, só quando `q` for um número inteiro; a busca SHALL NOT gerar erro `500` em nenhuma entidade.

#### Scenario: Texto em coluna numérica
- **WHEN** o operador busca `abc` em `GET /api/status`
- **THEN** a resposta é `200` com os status cujo `nome` ou `fluxo` contém `abc`

#### Scenario: Número em coluna numérica
- **GIVEN** um status com `periodo` 30
- **WHEN** o operador busca `30` em `GET /api/status`
- **THEN** esse status aparece na lista

### Requirement: Ordenação escolhida pelo operador
O kit SHALL ordenar a lista pelo parâmetro `sort=<campo>:asc|desc` quando `<campo>` estiver entre os `sortFields` da entidade, SHALL usar a ordem padrão da entidade quando `sort` estiver ausente ou não for permitido, e SHALL desempatar sempre por `id` decrescente. Na tela, as colunas ordenáveis SHALL ter o cabeçalho clicável, alternando crescente e decrescente, com `aria-sort` no cabeçalho.

#### Scenario: Ordenar contratos pelo vencimento
- **GIVEN** contratos com `dataTermino` 10/01/2027, 05/01/2027 e 20/01/2027
- **WHEN** o operador chama `GET /api/contratos?sort=dataTermino:asc`
- **THEN** a lista vem na ordem 05/01/2027, 10/01/2027, 20/01/2027

#### Scenario: Campo não permitido
- **WHEN** um cliente chama `GET /api/users?sort=passwordHash:asc`
- **THEN** a resposta é `200` na ordem padrão de usuários e nenhum erro de banco ocorre

#### Scenario: Clicar no cabeçalho
- **WHEN** o operador clica no cabeçalho "Vencimento" da lista de contratos e depois clica de novo
- **THEN** a lista é ordenada por vencimento crescente e, no segundo clique, decrescente, e o `sort` fica na URL da página

### Requirement: Campo opcional apagável na edição
O helper `optionalString()` SHALL converter um valor vazio, só com espaços ou `null` em `null` (o campo é apagado na gravação) e SHALL manter ausente o campo que não veio no corpo (o valor gravado não muda).

#### Scenario: Limpar um campo opcional
- **GIVEN** um pagamento com `notaFiscal` "123"
- **WHEN** o operador apaga `notaFiscal` no formulário de edição e salva
- **THEN** `notaFiscal` passa a `null` no banco e a tela mostra o campo vazio

#### Scenario: Campo ausente no corpo
- **GIVEN** um departamento com `deBairro` "Centro"
- **WHEN** um `PUT /api/departamentos/:id` chega sem `deBairro`
- **THEN** `deBairro` continua "Centro"

### Requirement: Valor único duplicado responde 409
O kit SHALL responder `409 { error: "Já existe um registro com esse valor" }` quando o banco recusar a gravação por violação de unicidade (`P2002`), sem gravar nada e sem deixar arquivo da requisição no disco.

#### Scenario: Gravação com valor único repetido
- **WHEN** a gravação de um registro falha no banco com `P2002`
- **THEN** a resposta é `409` com "Já existe um registro com esse valor"
- **AND** nenhum PDF enviado nessa requisição fica em `UPLOAD_DIR`
