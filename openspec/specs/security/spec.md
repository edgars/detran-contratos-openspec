# security Specification

## Purpose
Segurança da aplicação: o sistema SHALL exigir login, proteger a sessão, gravar só campos permitidos, aceitar apenas uploads válidos e tratar valores monetários sem perda de precisão.

## Requirements

### Requirement: Login obrigatório
O sistema SHALL exigir sessão válida em toda página e toda rota `/api/*`, exceto `/login` e `/api/auth/*`.

#### Scenario: Página sem sessão
- **WHEN** um visitante sem sessão abre `/contratos`
- **THEN** é redirecionado para `/login`

#### Scenario: API sem sessão
- **WHEN** uma requisição sem sessão chega em `POST /api/tipo_contratos`
- **THEN** a resposta é `401` e nada é gravado

### Requirement: Sessão emitida pelo servidor
O sistema SHALL emitir o identificador de sessão só no servidor, em cookie `httpOnly`, renová-lo a cada login e SHALL NOT aceitar identificador de sessão vindo de query string, corpo ou header customizado.

#### Scenario: Identificador na URL
- **GIVEN** um identificador de sessão válido de outro usuário
- **WHEN** uma requisição chega com `?sessionId=<identificador>` e sem cookie de sessão
- **THEN** a requisição é tratada como sem sessão

#### Scenario: Novo login
- **WHEN** o operador faz login
- **THEN** recebe um identificador de sessão novo, diferente do anterior

### Requirement: Senha guardada como hash
O sistema SHALL guardar senhas só como hash `argon2id` ou `bcrypt` (custo mínimo 12) e SHALL NOT devolver senha ou hash em nenhuma resposta de API nem exibi-los em lista ou formulário.

Alterado por 024-kit-robustez: a remoção em qualquer nível da resposta passa ao requisito *Campos de senha removidos em qualquer nível*.

#### Scenario: Ler um usuário
- **WHEN** o operador consulta `GET /api/users/:id`
- **THEN** a resposta não contém `password`, `passwordHash`, `passwordold`, `passwordnew` nem `passwordconfirm`

#### Scenario: Senha incorreta
- **WHEN** o operador tenta entrar com senha errada
- **THEN** o login é recusado com mensagem genérica, sem dizer se o usuário existe

### Requirement: Gravação só de campos permitidos
Toda rota de gravação SHALL validar o corpo contra o schema da entidade e gravar só os campos declarados; campo não declarado SHALL gerar `400`, e o nome do campo gravado SHALL NOT vir da requisição.

#### Scenario: Campo extra no corpo
- **WHEN** um `PUT /api/contrato_status/:id` chega com um campo que não está no schema
- **THEN** a resposta é `400` e nenhum campo é alterado

### Requirement: Upload de PDF validado
O sistema SHALL aceitar anexos só quando o conteúdo começa com a assinatura `%PDF-` e o tamanho não passa de `UPLOAD_MAX_MB`, SHALL gravá-los fora da pasta pública e SHALL servi-los só para sessões válidas.

Alterado por 024-kit-robustez: a limpeza de PDF sem referência passa ao requisito *PDF sem referência apagado do disco*.

#### Scenario: Arquivo renomeado para .pdf
- **WHEN** o operador envia uma imagem renomeada para `anexo.pdf`
- **THEN** o upload é recusado com "O arquivo anexo deve ser do tipo PDF!" e nada é gravado

#### Scenario: Baixar anexo sem sessão
- **WHEN** um visitante sem sessão pede a URL de um anexo
- **THEN** a resposta é `401`

### Requirement: Autoria pela sessão
O sistema SHALL preencher os campos de autoria (`userId` de `prestacao_contas` e de `penalidades`) com o usuário da sessão no servidor e SHALL ignorar qualquer valor de autoria enviado pelo cliente.

#### Scenario: Autoria forjada
- **WHEN** um usuário grava uma penalidade enviando `userId` de outro usuário
- **THEN** a penalidade é gravada com o `userId` do usuário da sessão

### Requirement: Consultas parametrizadas
O sistema SHALL montar consultas só pela API do Prisma ou por `$queryRaw` com template tag e SHALL NOT concatenar entrada do usuário em SQL.

#### Scenario: Busca com aspas
- **WHEN** o operador busca `' OR 1=1 --` na lista de contratos
- **THEN** a lista mostra só registros que contêm esse texto, e nenhum erro de SQL ocorre

### Requirement: Valores monetários em Decimal
O sistema SHALL guardar e calcular valores monetários (`valor`, `valorGlosa`, `valorInicial`, `valorMensal`, `valorTotal`) como `Decimal` e SHALL NOT convertê-los para ponto flutuante.

#### Scenario: Soma sem erro de arredondamento
- **WHEN** o sistema soma os valores `0,10` e `0,20`
- **THEN** o resultado é exatamente `0,30` e é exibido como `R$ 0,30`

### Requirement: PDF sem referência apagado do disco
O sistema SHALL NOT deixar no disco PDF que nenhum registro referencie: o arquivo gravado numa requisição que não termina com o registro gravado, o arquivo substituído numa edição (depois da gravação) e o arquivo de um registro excluído (depois da exclusão) SHALL ser apagados. Antes da 024 o arquivo ficava no disco nos três casos.

#### Scenario: Upload recusado não deixa arquivo
- **GIVEN** a pasta `UPLOAD_DIR` com N arquivos
- **WHEN** o operador envia um PDF válido num formulário que é recusado na validação
- **THEN** a resposta é `400` e `UPLOAD_DIR` continua com N arquivos

#### Scenario: Troca de anexo
- **GIVEN** uma penalidade com o arquivo `antigo.pdf`
- **WHEN** o operador grava a penalidade com um PDF novo
- **THEN** `antigo.pdf` não existe mais em `UPLOAD_DIR` e o PDF novo é servido pela URL do anexo

#### Scenario: Exclusão de registro com anexo
- **GIVEN** um anexo fiscal com o arquivo `f.pdf`
- **WHEN** o operador exclui o anexo fiscal
- **THEN** `f.pdf` não existe mais em `UPLOAD_DIR` e a URL do anexo responde `404`

### Requirement: Campos de senha removidos em qualquer nível
O sistema SHALL remover `password`, `passwordHash`, `passwordold`, `passwordnew` e `passwordconfirm` em qualquer nível da resposta de API, inclusive em usuários incluídos dentro de outro registro ou de uma lista. Antes da 024 só o primeiro nível era limpo, por `publicUser`.

#### Scenario: Usuário aninhado em outro registro
- **GIVEN** uma entidade configurada no kit com `include` do usuário completo (todas as colunas de `users`)
- **WHEN** o operador lista essa entidade pela API
- **THEN** nenhum item da resposta contém `passwordHash`, em nenhum nível

### Requirement: Acesso negado responde 403
Depois de confirmar a sessão, toda rota `/api/*` (exceto `/api/auth/*`, a troca da própria senha e `GET /api/auth/me`) SHALL checar no servidor a permissão do usuário para o recurso e a ação, pela matriz de `perfis-acesso`, e SHALL responder `403 { error: "Sem permissão para esta ação" }` sem gravar nada quando ela faltar. Sem sessão, a resposta SHALL continuar `401`. Os perfis SHALL ser lidos do banco a cada requisição e SHALL NOT vir de cookie, corpo, URL ou header.

#### Scenario: Consulta tenta criar contrato
- **GIVEN** um usuário só com o perfil Consulta
- **WHEN** ele chama `POST /api/contratos` com um corpo válido
- **THEN** a resposta é `403` e nenhum contrato é gravado

#### Scenario: Sem sessão continua 401
- **WHEN** uma requisição sem sessão chega em `DELETE /api/contratos/1`
- **THEN** a resposta é `401`, não `403`

#### Scenario: Perfil forjado no corpo
- **GIVEN** um usuário só com o perfil Consulta
- **WHEN** ele chama `POST /api/departamentos` com `perfis: ["ADMINISTRADOR"]` no corpo
- **THEN** a resposta é `403` e nada é gravado

#### Scenario: Perfil retirado vale na próxima requisição
- **GIVEN** um usuário Financeiro logado
- **WHEN** o Administrador retira dele o perfil Financeiro e ele chama `POST /api/pagamentos` em seguida, sem novo login
- **THEN** a resposta é `403`

### Requirement: Download de anexo conforme permissão
`GET /api/arquivos/:nome` SHALL servir o PDF só quando o usuário tiver `ver` no recurso que referencia o arquivo (`contratos`, `anexos_fiscais`, `anexos_publicacaos` ou `penalidades`); sem essa permissão SHALL responder `403`, e nome que nenhum registro referencia SHALL responder `404`. A visão restrita do contrato SHALL NOT dar acesso ao anexo do contrato.

#### Scenario: Consulta tenta baixar o anexo do contrato
- **GIVEN** um usuário só com o perfil Consulta e um contrato com `anexo`
- **WHEN** ele chama `GET /api/arquivos/<anexo do contrato>`
- **THEN** a resposta é `403`

#### Scenario: Fiscal baixa relatório de fiscalização
- **GIVEN** um usuário só com o perfil Fiscal e um anexo fiscal gravado
- **WHEN** ele chama `GET /api/arquivos/<anexo fiscal>`
- **THEN** a resposta é `200` com `Content-Type: application/pdf`
