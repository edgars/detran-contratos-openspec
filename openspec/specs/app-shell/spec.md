# app-shell Specification

## Purpose
Esqueleto da aplicação TDOC - Processos Detran: navegação, convenções de API, configuração por ambiente e dados de referência que toda entidade reutiliza.

## Requirements

### Requirement: Navegação principal
O sistema SHALL oferecer uma navegação principal com um item por entidade gerenciada: Departamentos, TipoContratos, ContratoStatus, Users, Pagamentos, Modalidades, PrestacaoContas, Fases, Fiscais, Status, Historicos, AnexosFiscais, SituacaoContratuals, AnexosPublicacaos, Penalidades, Contratos.

#### Scenario: Abrir o app
- **WHEN** o operador abre a aplicação
- **THEN** vê a navegação com Departamentos, TipoContratos, ContratoStatus, Users, Pagamentos, Modalidades, PrestacaoContas, Fases, Fiscais, Status, Historicos, AnexosFiscais, SituacaoContratuals, AnexosPublicacaos, Penalidades, Contratos e cada item abre a lista da entidade

### Requirement: Convenções da API
Toda entidade SHALL ser exposta em `/api/<entidade>` com lista paginada (`page`, `size`, `q`), `POST`, `GET /:id`, `PUT /:id` e `DELETE /:id`; erros de validação SHALL responder `400` com mensagem por campo.

#### Scenario: Corpo inválido
- **WHEN** um `POST` chega com um campo obrigatório vazio
- **THEN** a resposta é `400` e nomeia o campo e a mensagem

### Requirement: Configuração por ambiente
O sistema SHALL ler toda configuração (banco, URLs, segredos) de variáveis de ambiente documentadas em `.env.example`; nenhum segredo SHALL existir no código.

#### Scenario: Subir com `.env`
- **WHEN** o operador copia `.env.example` para `.env`, preenche e sobe o app
- **THEN** o app conecta ao banco e responde na porta configurada

### Requirement: Dados de referência somente leitura
As tabelas de referência (`diretorias`, `pessoas_fisicas`, `pessoas`, `prestadores_servicos`, `groups_users`, `pagamento_arquivos`, `groups`) SHALL ter apenas API de lista (`GET /api/<tabela>`) e aparecer como opções de dropdown nas entidades que as referenciam; o sistema SHALL NOT oferecer tela de criação, edição ou exclusão para elas.

#### Scenario: Carregar um dropdown
- **WHEN** um formulário com campo que referencia `diretorias` é aberto
- **THEN** as opções vêm de `GET /api/diretorias` e nenhuma rota de edição existe para `diretorias`
