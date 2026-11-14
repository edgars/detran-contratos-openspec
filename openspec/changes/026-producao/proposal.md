# Produção em servidor único (Docker Compose, SQLite, HTTPS e backup)

Depende de: `018-deployment` (arquivada), `023-perfis-acesso` e `025-migracao-legado` (aplicadas e arquivadas antes desta). Última change da onda: assume todas as anteriores arquivadas.

## Why

A `018-deployment` sobe a aplicação com `docker compose up --build`, mas só para teste: o app publica a porta 3000 em HTTP puro, não há TLS, nem cabeçalhos de segurança, nem healthcheck, nem backup do arquivo SQLite, e o `COOKIE_SECURE=false` documentado em `.env.example` é o único jeito de usá-la sem HTTPS. A decisão do autor de 13/11/2026 (`openspec/config.yaml`) fixa o alvo: **SQLite num único servidor com Docker Compose; backups e HTTPS fazem parte da 026**. Com um único arquivo de banco e uma pasta de anexos num único servidor, perder o disco é perder o sistema: backup com cópia para fora do servidor e restauração testada são requisito, não melhoria.

O legado tinha 6 achados críticos de segurança e roda em PHP sem suporte (`docs/levantamento.md` › Segurança); o app novo não pode ir para a rede do DETRAN-RJ sem HTTPS, cookie `Secure` e cabeçalhos básicos.

## What Changes

- **Proxy reverso Caddy 2 no compose** (`proxy`), único serviço com portas publicadas (80 e 443): HTTPS automático (ACME) ou com certificado do órgão montado em `./certs`, redirecionamento HTTP → HTTPS, HSTS, limite de corpo de requisição (`PROXY_MAX_BODY_MB`) coerente com `UPLOAD_MAX_MB`, log de acesso em JSON sem cookies. O serviço `app` deixa de publicar a porta 3000.
- **Cabeçalhos de segurança** no app (middleware): CSP com nonce por requisição, `frame-ancestors` configurável (`FRAME_ANCESTORS`) e `X-Frame-Options: SAMEORIGIN` só quando não há origem de prévia configurada, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Configuração validada no start** (`src/lib/env.ts`): em produção o app não sobe sem `AUTH_SECRET` forte, `APP_ORIGIN` em `https://`, e com `COOKIE_SECURE=false`; mensagem cita o nome da variável, nunca o valor.
- **Healthcheck** `GET /api/health` (banco respondendo e pasta de anexos gravável), usado pelo `healthcheck` do compose; responde só `{ "status": "ok" }` ou `503`, e o proxy o bloqueia de fora (exceção à diretiva de sessão, ver design.md › Open Questions).
- **Logs estruturados** em JSON por linha (`src/lib/log.ts`) para erros e eventos de segurança (login, logout, falha de login, 401/403, upload recusado), sem senha, hash, cookie ou token; rotação pelo driver `json-file` do Docker.
- **Backup** num serviço `backup` do compose: `sqlite3 .backup` agendado (diário, 02:00), `PRAGMA integrity_check` da cópia, compressão, retenção (14 diárias + 6 mensais), espelho da pasta de anexos com manifesto SHA-256 e cópia para fora do servidor por `rsync` sobre SSH (`BACKUP_REMOTE`).
- **Teste de restauração** automatizado (semanal no serviço `backup` e sob demanda) e script de restauração usado também no rollback.
- **Procedimento de atualização** (`scripts/ops/atualizar.sh`): backup imediato → imagem nova com tag de versão → `prisma migrate deploy` no start → espera healthy → smoke; **rollback** = imagem anterior + restauração do backup feito antes da atualização (Prisma não tem migração de descida).
- **Imagem** roda como usuário sem privilégio (`node`), com tag `APP_VERSION`.
- **CI no GitHub Actions** (`.github/workflows/ci.yml`): lint, `tsc`, testes, build, `openspec validate --all --strict` e build da imagem Docker (sem publicar).
- **Runbook** `docs/operacao.md`: instalação, variáveis, certificados, backup, restauração, atualização, rollback, rotação de segredo, primeiro acesso e solução de problemas.
- `.env.example` ganha a seção de produção com todas as variáveis novas.

## Capabilities

### New Capabilities

- `producao`: operação em produção num único servidor — HTTPS por proxy, cabeçalhos de segurança, configuração validada, healthcheck, logs estruturados, backup e restauração do SQLite e dos anexos, atualização com rollback, CI e runbook.

### Modified Capabilities

- `deployment`: a stack de produção passa a ter o proxy HTTPS como única porta publicada e o serviço de backup; o requisito "Subir a stack completa" é reescrito para essa topologia.
- `security`: o requisito "Login obrigatório" ganha a exceção de `GET /api/health` (só status, bloqueado no proxy) — depende de confirmação do autor (design.md › Open Questions).

## Impact

- **Arquivos novos:** `docker/caddy/Caddyfile`, `docker/backup/Dockerfile`, `docker/backup/backup.sh`, `docker/backup/restaurar.sh`, `docker/backup/testar-restauracao.sh`, `docker/backup/crontab`, `scripts/ops/atualizar.sh`, `scripts/ops/rollback.sh`, `src/app/api/health/route.ts`, `src/lib/env.ts`, `src/lib/log.ts`, `src/lib/security-headers.ts`, `.github/workflows/ci.yml`, `docs/operacao.md`, testes `tests/producao-*.test.ts`.
- **Arquivos alterados:** `docker-compose.yml` (serviços `proxy` e `backup`, `healthcheck`, rede interna, volumes `backups`, `caddy_data`, `caddy_config`, `logging`), `Dockerfile` (`USER node`, `HEALTHCHECK` não — fica no compose; label de versão), `docker/entrypoint.sh` (valida o ambiente antes do `migrate deploy`), `src/middleware.ts` (cabeçalhos, exceção do health), `src/app/layout.tsx` (nonce para o script do `next-themes`), `src/lib/auth/login.ts` e `src/app/api/auth/*` (eventos de log), `.env.example`, `scripts/smoke.mjs` (modo HTTPS e checagem de cabeçalhos), `README.md` (link para o runbook).
- **Coordenação:** o serviço `migrar` do compose (perfil `migracao`, `025-migracao-legado`) passa a usar a mesma rede interna e o volume `dados`; o runbook descreve a carga do legado chamando o procedimento da 025.
- **Sem mudança de modelo de dados** (nenhuma migração Prisma).

## Fora de escopo

- Alta disponibilidade, réplica do SQLite (ex.: Litestream contínuo), troca para PostgreSQL ou mais de um servidor: a decisão do autor é servidor único com SQLite.
- Publicação da imagem em registry e deploy automático pelo CI (CD): o CI só constrói e testa; a atualização no servidor é manual pelo runbook.
- Monitoramento externo, alertas por e-mail/Teams e agregador de logs (Loki, ELK): o runbook indica onde ligar, mas a ferramenta é do órgão.
- WAF, rate limiting e bloqueio de força bruta no login (podem vir numa change de segurança própria).
- Criptografia do backup em repouso no destino externo (depende da política do DETRAN-RJ; ver Open Questions).
- Varredura de vulnerabilidades da imagem e de dependências no CI (Dependabot, Trivy).
- Carga dos dados do legado: é da `025-migracao-legado`; aqui só o runbook aponta o procedimento.
