# Spec Delta

## MODIFIED Requirements

### Requirement: Login obrigatório
O sistema SHALL exigir sessão válida em toda página e toda rota `/api/*`, exceto `/login`, `/api/auth/*` e `GET /api/health`.

_Alterado pela 026-producao: acrescenta a exceção `GET /api/health` (ver *Healthcheck sem sessão restrito*), só com a confirmação registrada em design.md › Open Questions._

#### Scenario: Página sem sessão
- **WHEN** um visitante sem sessão abre `/contratos`
- **THEN** é redirecionado para `/login`

#### Scenario: API sem sessão
- **WHEN** uma requisição sem sessão chega em `POST /api/tipo_contratos`
- **THEN** a resposta é `401` e nada é gravado

## ADDED Requirements

### Requirement: Healthcheck sem sessão restrito
`GET /api/health` SHALL devolver só o status (`{"status":"ok"}` ou `{"status":"erro"}`) e SHALL ser bloqueado pelo proxy para requisições de fora do servidor; outro método nessa rota SHALL exigir sessão. Exceção à diretiva do autor sobre sessão, aceita só com a confirmação registrada em design.md › Open Questions.

#### Scenario: Healthcheck sem sessão
- **WHEN** uma requisição `GET /api/health` sem sessão chega ao app pela rede interna
- **THEN** a resposta é `200 {"status":"ok"}` sem nenhum outro campo

#### Scenario: Outro método no healthcheck
- **WHEN** uma requisição `POST /api/health` sem sessão chega ao app
- **THEN** a resposta é `401`
