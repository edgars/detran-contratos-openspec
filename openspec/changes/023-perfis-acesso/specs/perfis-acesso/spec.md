# Spec Delta

## Purpose

Perfis de acesso: o sistema SHALL controlar o que cada usuário lista, vê, cria, edita, exclui, anexa e exporta pelos perfis Administrador, Gestor de contrato, Fiscal, Financeiro e Consulta (decisão do autor de 13/11/2026), substituindo os grupos do ACL do legado (`docs/legado/perfis-acesso.md`).

## ADDED Requirements

### Requirement: Catálogo de perfis
O sistema SHALL ter exatamente os perfis `ADMINISTRADOR` (Administrador), `GESTOR_CONTRATO` (Gestor de contrato), `FISCAL` (Fiscal), `FINANCEIRO` (Financeiro) e `CONSULTA` (Consulta). Um usuário SHALL poder ter mais de um perfil, e as permissões dele SHALL ser a união das permissões dos seus perfis.

#### Scenario: Usuário com dois perfis
- **GIVEN** um usuário com os perfis Fiscal e Financeiro
- **WHEN** ele cria um pagamento e depois um anexo fiscal
- **THEN** as duas gravações são aceitas

#### Scenario: Perfil fora do catálogo
- **WHEN** o Administrador grava um usuário com o perfil `SUPERVISOR`
- **THEN** a API responde `400` com erro no campo `perfis` e nada é gravado

### Requirement: Permissões de contratos
O sistema SHALL aplicar ao recurso `contratos` (lista, detalhe, cadastro, edição, exclusão, aditivos, anexos do cadastro e complementos da 020): Administrador listar, ver, criar, editar, excluir e anexar; Gestor de contrato listar, ver, criar, editar e anexar; Fiscal e Financeiro listar e ver; Consulta listar e ver só a visão restrita. Criar aditivo SHALL exigir `criar` em `contratos`.

#### Scenario: Gestor não exclui contrato
- **GIVEN** um usuário só com o perfil Gestor de contrato
- **WHEN** ele chama `DELETE /api/contratos/:id`
- **THEN** a resposta é `403` e o contrato continua gravado

#### Scenario: Financeiro não cria aditivo
- **GIVEN** um usuário só com o perfil Financeiro
- **WHEN** ele chama `POST /api/contratos/:id/aditivos`
- **THEN** a resposta é `403` e nenhum aditivo é criado

#### Scenario: Gestor anexa projeto básico
- **GIVEN** um usuário só com o perfil Gestor de contrato
- **WHEN** ele edita um contrato enviando um PDF válido
- **THEN** o contrato é gravado com o anexo

### Requirement: Permissões dos registros do contrato
O sistema SHALL aplicar: fluxo do contrato (`contrato_status`, inclusive a tela da 020) e `historicos` — Administrador tudo; Gestor de contrato e Fiscal listar, ver, criar e editar; Financeiro listar e ver. `fiscais` — Administrador e Gestor de contrato tudo; Fiscal e Financeiro listar e ver. `penalidades` — Administrador tudo; Gestor de contrato tudo menos excluir; Fiscal e Financeiro listar e ver. Consulta SHALL NOT acessar esses recursos.

#### Scenario: Fiscal registra andamento
- **GIVEN** um usuário só com o perfil Fiscal
- **WHEN** ele cria um histórico de um contrato
- **THEN** o histórico é gravado

#### Scenario: Fiscal não designa fiscal
- **GIVEN** um usuário só com o perfil Fiscal
- **WHEN** ele chama `POST /api/fiscais`
- **THEN** a resposta é `403`

#### Scenario: Consulta não vê históricos
- **GIVEN** um usuário só com o perfil Consulta
- **WHEN** ele chama `GET /api/historicos`
- **THEN** a resposta é `403`

### Requirement: Permissões de anexos
O sistema SHALL aplicar: `anexos_fiscais` — Administrador e Gestor de contrato tudo; Fiscal listar, ver, criar, editar e anexar; Financeiro listar e ver. `anexos_publicacaos` — Administrador e Gestor de contrato tudo; Fiscal e Financeiro listar e ver. Consulta SHALL NOT acessar esses recursos. Enviar arquivo SHALL exigir `anexar` além de `criar` ou `editar`, checado antes de gravar o arquivo.

#### Scenario: Fiscal envia relatório de fiscalização
- **GIVEN** um usuário só com o perfil Fiscal
- **WHEN** ele cria um anexo fiscal com um PDF válido
- **THEN** o anexo é gravado

#### Scenario: Financeiro tenta anexar publicação
- **GIVEN** um usuário só com o perfil Financeiro e a pasta `UPLOAD_DIR` com N arquivos
- **WHEN** ele chama `POST /api/anexos_publicacaos` com um PDF válido
- **THEN** a resposta é `403` e `UPLOAD_DIR` continua com N arquivos

### Requirement: Permissões de pagamentos
O sistema SHALL permitir listar, ver, criar, editar e excluir pagamentos ao Administrador e ao Financeiro (grupo `Pagamentos` do legado), só listar e ver ao Gestor de contrato e ao Fiscal, e SHALL NOT dar acesso a pagamentos à Consulta.

#### Scenario: Financeiro registra pagamento
- **GIVEN** um usuário só com o perfil Financeiro
- **WHEN** ele grava um pagamento válido
- **THEN** o pagamento é gravado

#### Scenario: Gestor não altera pagamento
- **GIVEN** um usuário só com o perfil Gestor de contrato
- **WHEN** ele chama `PUT /api/pagamentos/:id`
- **THEN** a resposta é `403` e o pagamento não muda

### Requirement: Permissões de prestação de contas
O sistema SHALL tratar a permissão do grupo `PrestacaoConta` do legado como capacidade do Gestor de contrato: `prestacao_contas` (cadastro da 008, painel de pendentes/realizadas e fluxo da 021) — Administrador tudo; Gestor de contrato listar, ver, criar e editar; Fiscal e Financeiro listar e ver; Consulta sem acesso.

#### Scenario: Gestor grava fase da prestação
- **GIVEN** um usuário só com o perfil Gestor de contrato
- **WHEN** ele grava uma fase no fluxo de prestação de contas de um contrato
- **THEN** a fase é gravada

#### Scenario: Fiscal só consulta a prestação
- **GIVEN** um usuário só com o perfil Fiscal
- **WHEN** ele tenta gravar uma fase da prestação de contas
- **THEN** a resposta é `403`

### Requirement: Permissões de relatórios
O sistema SHALL permitir ver os relatórios da 019 (por gestor, vencendo, vencidos, cadastro incompleto, acompanhamento de meta) a todos os perfis, e exportá-los (PDF, Excel, impressão) a todos menos Consulta. O relatório "Acerto de valor", que grava o valor inicial, SHALL ser só do Administrador (listar e editar).

#### Scenario: Consulta não exporta
- **GIVEN** um usuário só com o perfil Consulta
- **WHEN** ele abre o relatório de contratos vencendo e pede a exportação em Excel pela API
- **THEN** a tela do relatório abre, mas a exportação responde `403` e o botão *Exportar* não aparece

#### Scenario: Gestor não acerta valor
- **GIVEN** um usuário só com o perfil Gestor de contrato
- **WHEN** ele tenta gravar um valor inicial pelo "Acerto de valor"
- **THEN** a resposta é `403` e `valorInicial` não muda

### Requirement: Permissões de cadastros e referências
O sistema SHALL permitir criar, editar e excluir os cadastros auxiliares (`departamentos`, `tipo_contratos`, `modalidades`, `situacao_contratuals`, `fases`, `status`) só ao Administrador, e listar e ver a todos os perfis. As tabelas de referência (`diretorias`, `pessoas`, `pessoas_fisicas`, `prestadores_servicos`, `pagamento_arquivos`) SHALL ser listáveis por todos os perfis; `groups` e `groups_users`, só pelo Administrador.

#### Scenario: Gestor não cria departamento
- **GIVEN** um usuário só com o perfil Gestor de contrato
- **WHEN** ele chama `POST /api/departamentos`
- **THEN** a resposta é `403`

#### Scenario: Dropdown para todos
- **GIVEN** um usuário só com o perfil Consulta
- **WHEN** ele chama `GET /api/prestadores_servicos`
- **THEN** a resposta é `200` com a lista

### Requirement: Usuários e perfis só para Administrador
O sistema SHALL permitir listar, ver, criar, editar e excluir usuários e atribuir perfis só ao Administrador. A troca da própria senha (`/conta/senha`) e `GET /api/auth/me` SHALL continuar disponíveis a todo usuário logado, com ou sem perfil.

#### Scenario: Gestor tenta abrir usuários
- **GIVEN** um usuário só com o perfil Gestor de contrato
- **WHEN** ele chama `GET /api/users`
- **THEN** a resposta é `403`

#### Scenario: Consulta troca a própria senha
- **GIVEN** um usuário só com o perfil Consulta
- **WHEN** ele troca a própria senha em `/conta/senha` com a senha atual correta
- **THEN** a troca é aceita

### Requirement: Escopo dos perfis sobre os contratos
O sistema SHALL aplicar as permissões de Gestor de contrato, Fiscal e Financeiro a todos os contratos, sem restrição por unidade gestora ou por contrato, como o legado (`40_seed_acl.sql`: todos os grupos acessam a árvore `contratos` inteira).

#### Scenario: Gestor edita contrato de outra unidade
- **GIVEN** um usuário só com o perfil Gestor de contrato e um contrato de qualquer unidade gestora
- **WHEN** ele edita esse contrato
- **THEN** a gravação é aceita

### Requirement: Visão restrita do contrato
Para o usuário que não tem `ver` em `contratos` (Consulta), o sistema SHALL devolver na lista e no detalhe só os dados do contrato — identificação, tipo, modalidade, objeto, unidade gestora, fornecedor, gestor e suplente, vigência, valores, situação e aditivos — sem `anexo`, `anexoTipo`, `projetoBasico`, anexos de publicação ou fiscais, fluxo, históricos, penalidades, pagamentos e prestação de contas, e SHALL NOT mostrar ações de edição (como `visualizar_restrito` do legado).

#### Scenario: Consulta abre um contrato
- **GIVEN** um usuário só com o perfil Consulta e um contrato com anexo e anexo de publicação
- **WHEN** ele abre `/contratos/[id]`
- **THEN** vê número, objeto, vigência e valores, sem os blocos de anexos e sem os botões *Editar* e *Novo aditivo*

#### Scenario: API do contrato para Consulta
- **GIVEN** um usuário só com o perfil Consulta
- **WHEN** ele chama `GET /api/contratos/:id` e `GET /api/contratos`
- **THEN** as respostas não contêm `anexo`, `anexoTipo` nem `projetoBasico`

### Requirement: Usuário sem perfil
O sistema SHALL tratar o usuário logado sem nenhum perfil como sem permissão em todos os recursos: ele entra, vê a página inicial e a troca de senha, e toda outra API responde `403`.

#### Scenario: Usuário sem perfil abre contratos
- **GIVEN** um usuário sem perfil
- **WHEN** ele chama `GET /api/contratos`
- **THEN** a resposta é `403`

### Requirement: Menu e ações conforme as permissões
A interface SHALL mostrar no menu lateral só os itens cujo recurso o usuário pode listar (escondendo o grupo que ficar vazio) e SHALL mostrar *Novo*, *Editar*, *Excluir*, os campos de anexo e *Exportar* só quando o usuário tiver a ação correspondente; sem `editar` e com `ver`, o formulário SHALL abrir em modo leitura.

#### Scenario: Menu da Consulta
- **GIVEN** um usuário só com o perfil Consulta
- **WHEN** ele abre o app
- **THEN** o menu mostra Contratos, Relatórios e os cadastros auxiliares, e não mostra Usuários, Pagamentos, Históricos nem Anexos

#### Scenario: Lista sem permissão de criar
- **GIVEN** um usuário só com o perfil Fiscal
- **WHEN** ele abre `/pagamentos`
- **THEN** vê a lista sem o botão *Novo*, e o pagamento aberto aparece em modo leitura, sem *Salvar* nem *Excluir*

### Requirement: Página sem permissão
Toda página da área logada SHALL checar no servidor a permissão da ação que ela executa; sem a permissão, SHALL mostrar "Você não tem permissão para acessar esta página." e SHALL NOT carregar os dados do recurso.

#### Scenario: Abrir URL de criação sem permissão
- **GIVEN** um usuário só com o perfil Financeiro
- **WHEN** ele digita `/contratos/new` na barra de endereço
- **THEN** vê "Você não tem permissão para acessar esta página." e nenhum formulário

### Requirement: Usuário inicial Administrador
O usuário inicial criado a partir de `ADMIN_USERNAME`/`ADMIN_PASSWORD` com a tabela `users` vazia SHALL receber o perfil Administrador.

#### Scenario: Primeiro login
- **GIVEN** a tabela `users` vazia e `ADMIN_USERNAME`/`ADMIN_PASSWORD` configurados
- **WHEN** o primeiro login cria o usuário inicial
- **THEN** ele tem o perfil Administrador e abre `/users`

### Requirement: Migração dos usuários atuais
A migração da change SHALL dar perfis a todos os usuários existentes, nesta ordem: grupos do legado em `groups_users` (`ContratoCGCL` → Administrador; `Gestor` e `PrestacaoConta` → Gestor de contrato; `Pagamentos` → Financeiro); `superuser = 1` → Administrador; quem continuar sem perfil → Consulta; e, se não houver Administrador, o usuário ativo de menor `id` → Administrador. A migração SHALL ser idempotente.

#### Scenario: Usuário superuser
- **GIVEN** um usuário com `superuser = 1` e outro com `superuser` nulo, sem grupos
- **WHEN** a migração roda
- **THEN** o primeiro tem o perfil Administrador e o segundo, Consulta

#### Scenario: Grupo do legado
- **GIVEN** um usuário nos grupos `Gestor` e `Pagamentos` em `groups_users`
- **WHEN** a migração roda
- **THEN** ele tem os perfis Gestor de contrato e Financeiro

#### Scenario: Rodar duas vezes
- **WHEN** a migração de dados roda de novo
- **THEN** nenhum perfil é duplicado nem removido

### Requirement: Ao menos um Administrador
O sistema SHALL recusar com `409` que o Administrador logado remova o próprio perfil Administrador, e SHALL conferir, na mesma transação da gravação ou da exclusão de usuário, que continua existindo ao menos um usuário com perfil Administrador, recusando com `409` "O sistema precisa de ao menos um Administrador" caso contrário.

#### Scenario: Remover o próprio perfil
- **GIVEN** o único Administrador do sistema, logado
- **WHEN** ele grava o próprio usuário só com o perfil Consulta
- **THEN** a resposta é `409` com "Não é possível remover o seu próprio perfil de Administrador" e os perfis não mudam

#### Scenario: Remover Administrador de outro usuário
- **GIVEN** dois usuários Administrador, A logado e B
- **WHEN** A grava B só com o perfil Fiscal
- **THEN** a gravação é aceita e A continua Administrador

### Requirement: Permissões do usuário logado
`GET /api/auth/me` SHALL devolver os perfis do usuário logado e a lista de permissões no formato `recurso:ação`, lidos do banco na requisição, sem campos de senha.

#### Scenario: Consultar as próprias permissões
- **GIVEN** um usuário só com o perfil Financeiro
- **WHEN** ele chama `GET /api/auth/me`
- **THEN** a resposta tem `perfis: ["FINANCEIRO"]` e `permissoes` contém `pagamentos:criar` e não contém `contratos:editar`
