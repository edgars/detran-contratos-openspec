# Spec Delta

## ADDED Requirements

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
