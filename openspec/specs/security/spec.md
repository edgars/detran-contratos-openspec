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
