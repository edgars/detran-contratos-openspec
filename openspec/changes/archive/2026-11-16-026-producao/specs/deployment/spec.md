# Spec Delta

## MODIFIED Requirements

### Requirement: Subir a stack completa
O sistema SHALL subir a aplicação completa com um único comando (`docker compose up -d --build`): o serviço `app` (Next.js com frontend e API, SQLite no volume `dados`), o proxy reverso `proxy` (Caddy, HTTPS, única porta publicada) e o serviço `backup`, e SHALL manter banco e anexos entre reinícios.

_Alterado pela 026-producao: passa a ser `app` + `proxy` HTTPS + `backup`, só o proxy exposto (antes "frontend, API e banco" com o app em HTTP)._

#### Scenario: Primeiro start
- **WHEN** o operador roda `docker compose up -d --build` com um `.env` de produção preenchido
- **THEN** o `app` fica `healthy`, o sistema responde em `https://<SITE_ADDRESS>`, a API responde `/api` (com `401` sem sessão) e um registro criado sobrevive a `docker compose restart`

#### Scenario: Só o proxy exposto
- **WHEN** o operador lista as portas publicadas com `docker compose ps`
- **THEN** só o serviço `proxy` publica portas (80 e 443)

## ADDED Requirements

### Requirement: Proxy espera o app saudável
O serviço `proxy` SHALL esperar o `app` ficar `healthy` (`depends_on` com `condition: service_healthy`) antes de encaminhar requisições.

#### Scenario: App ainda iniciando
- **WHEN** o operador roda `docker compose up -d --build` e consulta `docker compose ps` logo em seguida
- **THEN** o `proxy` só aparece `running` depois que o `app` aparece `healthy`
