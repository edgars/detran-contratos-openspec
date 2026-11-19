# Design

## Context

Estado atual (fim da `018-deployment`):

- `docker-compose.yml`: um serviço `app` (Next.js `standalone`), porta `${PORT:-3000}:3000` publicada em HTTP, volume nomeado `dados` em `/app/data` com o SQLite (`/app/data/app.db`) e os anexos (`/app/data/uploads`), `restart: unless-stopped`.
- `Dockerfile`: multi-stage `deps` → `build` → `run`, roda como `root`; `docker/entrypoint.sh` faz `prisma migrate deploy` e `exec node server.js`.
- Cookie de sessão (`src/lib/auth/session.ts:31-34`): `secure` em produção, exceto com `COOKIE_SECURE=false`; `SameSite=None` (e `Secure`) quando `COOKIE_SAMESITE=none`, usado para abrir o app dentro de um iframe (a "prévia").
- `src/middleware.ts`: exige sessão em tudo menos `/login` e `/api/auth/*` (diretiva do autor) e aplica CORS só para `APP_ORIGIN`. Nenhum cabeçalho de segurança.
- Uploads: `savePdf()` (`src/lib/uploads.ts`) limita a `UPLOAD_MAX_MB` (padrão 10) depois de o corpo inteiro chegar ao Node.
- Fontes servidas localmente (`public/fonts/google-sans`, `src/app/fonts.css`); nenhum recurso de terceiros carregado pelo navegador.
- Não há `/api/health`, nem log estruturado, nem backup, nem CI (`.github/` não existe).

Decisão do autor (13/11/2026, `openspec/config.yaml`): **produção mantém SQLite num único servidor com Docker Compose; backups e HTTPS fazem parte da 026.**

## Goals / Non-Goals

**Goals:**
- Um servidor com Docker e Docker Compose roda a aplicação em HTTPS seguindo só `docs/operacao.md`.
- Perder o servidor custa no máximo um dia de dados (RPO 24 h) e a volta é um procedimento escrito e testado (restauração testada toda semana).
- Atualizar e voltar uma versão são scripts, com backup antes de qualquer migração.
- Nenhum segredo em imagem, log ou backup de configuração.

**Non-Goals:**
- Alta disponibilidade, réplica contínua, mais de um servidor, outro banco.
- CD (deploy automático), registry de imagens, monitoramento externo.

## Decisions

### Topologia do compose

| Serviço | Imagem | Portas publicadas | Volumes | Observação |
|---|---|---|---|---|
| `proxy` | `caddy:2-alpine` (versão fixada por digest no compose) | `80:80`, `443:443` | `./docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro`, `caddy_data:/data`, `caddy_config:/config`, `./certs:/certs:ro` | TLS, HSTS, limite de corpo, log de acesso JSON |
| `app` | build do `Dockerfile` (`detran-contratos:${APP_VERSION}`) | **nenhuma** (`expose: 3000`) | `dados:/app/data` | `healthcheck` em `/api/health`; `USER node` |
| `backup` | build de `docker/backup/Dockerfile` (`alpine` + `sqlite`, `rsync`, `openssh-client`, `tzdata`, `busybox` crond) | nenhuma | `dados:/data`, `backups:/backups`, `./secrets/backup:/run/secrets/backup:ro` | cron: backup diário 02:00, teste de restauração domingo 03:30 |
| `migrar` | (da `025-migracao-legado`, perfil `migracao`) | nenhuma | `dados`, `./import:/import:ro` | só sobe com `--profile migracao` |

- Rede `interna` (bridge) para todos; só `proxy` publica portas. `proxy` depende de `app` com `condition: service_healthy`.
- `logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }` em todos os serviços (âncora YAML `x-logging`).
- `restart: unless-stopped` em todos menos `migrar`.
- `TZ=America/Sao_Paulo` em `backup` (horário do cron); o app continua tratando datas sem hora em UTC (`src/lib/format.ts`).

### Proxy reverso: Caddy

- **Caddy em vez de Nginx + certbot**: HTTPS automático (ACME, renovação sozinha) ou certificado próprio com uma linha, HSTS e redirecionamento HTTP → HTTPS nativos, um processo, um arquivo de configuração. Para um servidor único sem equipe de infraestrutura dedicada ao sistema, é o menor número de peças.
- `docker/caddy/Caddyfile` (variáveis vindas do `.env`):

```
{
	email {$ACME_EMAIL}
}

{$SITE_ADDRESS} {
	tls {$CADDY_TLS}
	encode zstd gzip

	@health path /api/health
	respond @health 404

	request_body {
		max_size {$PROXY_MAX_BODY_MB}MB
	}

	header {
		Strict-Transport-Security "max-age=31536000"
		-Server
	}

	reverse_proxy app:3000

	log {
		output stdout
		format filter {
			wrap json
			fields {
				request>headers>Cookie delete
				request>headers>Authorization delete
				resp_headers>Set-Cookie delete
			}
		}
	}
}
```

- `CADDY_TLS` aceita: o e-mail ACME (certificado público automático, exige DNS público e portas 80/443 abertas para a internet), `internal` (CA própria do Caddy, só para homologação) ou `/certs/fullchain.pem /certs/privkey.pem` (certificado emitido pelo DETRAN-RJ, provável na intranet — ver Open Questions).
- HSTS sem `includeSubDomains` nem `preload`: o domínio provavelmente é compartilhado com outros sistemas do órgão.
- `/api/health` responde `404` para quem vem pelo proxy: o healthcheck só é usado de dentro da rede do compose.
- **Limite de corpo**: `PROXY_MAX_BODY_MB` (padrão `11`) deve ser maior que `UPLOAD_MAX_MB` (padrão `10`) para caber o overhead do multipart; acima dele o Caddy responde `413` antes de o corpo chegar ao Node. `src/lib/env.ts` recusa subir se `PROXY_MAX_BODY_MB <= UPLOAD_MAX_MB` (o `app` recebe as duas variáveis).

### Cookies e confiança no proxy

- Em produção o cookie de sessão é sempre `Secure` e `httpOnly`; `COOKIE_SECURE=false` passa a ser **recusado** em produção por `src/lib/env.ts` (continua valendo só fora de `NODE_ENV=production`, para testes locais em HTTP). `src/lib/auth/session.ts` não muda de lógica.
- `APP_ORIGIN` deve ser `https://<SITE_ADDRESS>`: o CORS (`src/lib/api/cors.ts`) já usa essa variável.
- O app não lê IP de cliente para decisão nenhuma; o IP só aparece no log de acesso do Caddy.

### Cabeçalhos de segurança (app)

Aplicados em `src/middleware.ts` por `src/lib/security-headers.ts` (função pura `securityHeaders({ nonce, frameAncestors })`, testável sem servidor), em toda resposta que passa pelo middleware (páginas e `/api`), inclusive redirecionamentos e `401`. Os estáticos (`_next/static`, fontes) ficam fora do matcher e recebem só os do Caddy.

| Cabeçalho | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-<nonce>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors <FRAME_ANCESTORS ou 'self'>` |
| `X-Frame-Options` | `SAMEORIGIN` quando `FRAME_ANCESTORS` está vazio; **ausente** quando há origem de prévia configurada |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

- **Nonce**: o middleware gera 16 bytes aleatórios (base64) por requisição e repassa no cabeçalho de requisição `x-nonce` e no CSP (padrão documentado do Next.js 15); `src/app/layout.tsx` lê `headers().get("x-nonce")` e passa `nonce` ao `ThemeProvider` (`next-themes` injeta um script inline). Todas as páginas já são dinâmicas (dependem da sessão), então o nonce não perde cache estático.
- **`style-src 'unsafe-inline'`**: componentes do shadcn/ui (base-ui) e o Next aplicam `style=""` inline; sem isso a interface quebra. Risco aceito (ver Risks).
- **Prévia em iframe**: `X-Frame-Options` não aceita uma origem específica (`ALLOW-FROM` é ignorado pelos navegadores atuais). Por isso: sem `FRAME_ANCESTORS` → `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`; com `FRAME_ANCESTORS="https://os.exemplo"` (lista separada por espaço, cada item validado como origem `https://`) → `frame-ancestors 'self' <origens>` e sem `X-Frame-Options`, para não bloquear a prévia. A prévia também exige `COOKIE_SAMESITE=none` (já existente). Em produção do DETRAN-RJ o padrão é deixar `FRAME_ANCESTORS` vazio.
- `/api/arquivos/<nome>` (PDF `inline`) herda `frame-ancestors`, então o PDF abre em `<iframe>`/aba do próprio app.

### Configuração validada no start (`src/lib/env.ts`)

- Schema `zod` das variáveis de produção, chamado por `docker/entrypoint.sh` (`node /app/check-env.js`, compilado junto do standalone) **antes** do `prisma migrate deploy`, e também importado por `src/instrumentation.ts` (`register()`), que roda no start do Next.
- Em `NODE_ENV=production` falha (exit 1, mensagem em pt-BR com os **nomes** das variáveis inválidas, nunca os valores) quando: `AUTH_SECRET` ausente ou com menos de 32 bytes depois de base64; `APP_ORIGIN` não começa com `https://`; `COOKIE_SECURE=false`; `COOKIE_SAMESITE` diferente de vazio/`lax`/`none`; `FRAME_ANCESTORS` com item que não é origem `https://`; `UPLOAD_MAX_MB` não é inteiro positivo; `PROXY_MAX_BODY_MB <= UPLOAD_MAX_MB`; `DATABASE_URL` não começa com `file:`.
- `ADMIN_PASSWORD` preenchido em produção gera **aviso** no log (não erro): só é usado com `users` vazia (`src/lib/auth/seed.ts`); o runbook manda apagá-lo do `.env` depois do primeiro acesso.

### Variáveis de ambiente de produção (`.env.example`, seção "Produção")

| Variável | Serviço | Exemplo / padrão | Obrigatória |
|---|---|---|---|
| `APP_VERSION` | compose (`app`) | `1.0.0` (tag git) | sim |
| `SITE_ADDRESS` | `proxy` | `contratos.detran.rj.gov.br` | sim |
| `CADDY_TLS` | `proxy` | `/certs/fullchain.pem /certs/privkey.pem` ou e-mail ou `internal` | sim |
| `ACME_EMAIL` | `proxy` | e-mail técnico do órgão | só com ACME |
| `PROXY_MAX_BODY_MB` | `proxy`, `app` | `11` | sim |
| `APP_ORIGIN` | `app` | `https://contratos.detran.rj.gov.br` | sim |
| `AUTH_SECRET` | `app` | `openssl rand -base64 32` | sim |
| `DATABASE_URL` | `app` (fixo no compose) | `file:/app/data/app.db` | — |
| `UPLOAD_DIR` | `app` (fixo no compose) | `/app/data/uploads` | — |
| `UPLOAD_MAX_MB` | `app` | `10` | sim |
| `COOKIE_SECURE` | `app` | vazio (proibido `false` em produção) | não |
| `COOKIE_SAMESITE` | `app` | vazio; `none` só para prévia em iframe | não |
| `FRAME_ANCESTORS` | `app` | vazio; origens `https://` da prévia | não |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `app` | só no primeiro start; apagar depois | não |
| `LOG_LEVEL` | `app` | `info` (`debug`, `info`, `warn`, `error`) | não |
| `TZ` | `backup` | `America/Sao_Paulo` | sim |
| `BACKUP_HORARIO` | `backup` | `0 2 * * *` | não |
| `BACKUP_RETENCAO_DIARIA` | `backup` | `14` | não |
| `BACKUP_RETENCAO_MENSAL` | `backup` | `6` | não |
| `BACKUP_REMOTE` | `backup` | `backup@srv-backup.detran:/backups/contratos` | sim em produção (vazio só gera alerta) |

A chave SSH do backup e o `known_hosts` do destino ficam em `./secrets/backup/` (permissão `600`, fora do git e do contexto de build — `.dockerignore` e `.gitignore` ganham `secrets/` e `certs/`).

### Healthcheck

- `GET /api/health` (`src/app/api/health/route.ts`, `dynamic = "force-dynamic"`): executa `SELECT 1` pelo Prisma (`$queryRaw` com template tag) e `fs.access(uploadDir(), W_OK)`; `200 { "status": "ok" }` ou `503 { "status": "erro" }`. **Nada mais** na resposta (sem versão, sem mensagem de erro, sem contagens); a causa vai para o log (`level: "error"`, `evento: "health"`).
- Exceção em `isPublicPath` (`src/middleware.ts`) só para o caminho exato `/api/health` e método `GET`; o proxy responde `404` a ele de fora.
- Compose: `healthcheck: { test: ["CMD", "wget", "-q", "-O", "-", "http://127.0.0.1:3000/api/health"], interval: 30s, timeout: 5s, retries: 3, start_period: 60s }` (o `start_period` cobre o `migrate deploy`). `wget` é o do BusyBox da imagem alpine.

### Logs estruturados

- `src/lib/log.ts`: `log(level, evento, campos)` escreve **uma linha JSON** em stdout: `{ "ts": ISO-8601, "level", "evento", "msg"?, "rota"?, "metodo"?, "status"?, "userId"?, "username"?, "erro"? }`. Respeita `LOG_LEVEL`.
- Lista de chaves proibidas aplicada antes de serializar (remove recursivamente): `password`, `passwordHash`, `passwordold`, `passwordnew`, `passwordconfirm`, `senha`, `token`, `cookie`, `authorization`, `AUTH_SECRET`, `sessionId`. Teste garante.
- Eventos: `login.ok`, `login.falha` (só `username`, nunca a senha), `logout`, `sessao.invalida` (401 em `/api`), `acesso.negado` (403 da 023), `upload.recusado` (motivo e campo), `erro.interno` (rota, método, `erro.name`, `erro.message`, stack só com `LOG_LEVEL=debug`), `health`, `env.aviso`.
- Erros 500: o `crudHandlers` e as rotas próprias já têm `try/catch`; o ponto único é `src/lib/api/http.ts` (resposta de erro), que passa a chamar `log("error", "erro.interno", …)`.
- Acesso HTTP (status, duração, IP) vem do log JSON do Caddy, com `Cookie`, `Authorization` e `Set-Cookie` removidos.
- Retenção: rotação do Docker (`10m` × 5 arquivos por serviço). Envio a um agregador é fora de escopo.

### Backup do banco

- `docker/backup/backup.sh [--motivo <texto>]`:
  1. `sqlite3 /data/app.db ".backup '/backups/tmp/app.db'"` — API de backup online do SQLite, segura com o app gravando (não copia o arquivo cru).
  2. `sqlite3 /backups/tmp/app.db "PRAGMA integrity_check"` deve devolver `ok`; senão aborta com `level: "error"` e não substitui nada.
  3. Contagem de linhas de cada tabela do usuário (`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`) e a última migração aplicada (`_prisma_migrations`) gravadas em `app-<AAAAMMDD-HHMMSS>[-<motivo>].json`.
  4. `gzip -9` → `/backups/db/app-<AAAAMMDD-HHMMSS>[-<motivo>].db.gz` + `.sha256`.
  5. Anexos (abaixo), retenção, cópia externa. Cada etapa loga uma linha JSON (`evento: "backup.*"`).
- **Por que `.backup` e não `VACUUM INTO`**: os dois são consistentes; `.backup` não reescreve o banco inteiro e não exige espaço de compactação. `VACUUM INTO` fica como alternativa documentada.
- **Retenção** (`docker/backup/retencao.sh`): mantém os `BACKUP_RETENCAO_DIARIA` mais recentes (padrão 14) e o primeiro backup de cada um dos últimos `BACKUP_RETENCAO_MENSAL` meses (padrão 6); backups com motivo (`pre-atualizacao-*`, `pre-migracao-*`) são guardados por 90 dias independentemente da regra.
- Backups `pre-migracao-*.db` gravados pela carga da `025-migracao-legado` em `/app/data/backups/` (volume `dados`) são comprimidos e movidos para `/backups/db/` pelo `backup.sh` seguinte, entrando na mesma retenção e na cópia externa.
- Agendamento: `crontab` do BusyBox com `BACKUP_HORARIO` (padrão `0 2 * * *`). Backup sob demanda: `docker compose run --rm backup backup.sh --motivo manual`.

### Backup dos anexos

- Os anexos são imutáveis (nome UUID gerado por `savePdf`), então o backup é um **espelho incremental**: `rsync -a /data/uploads/ /backups/uploads/` **sem** `--delete` (arquivo apagado no app continua no backup; limpeza é manual pelo runbook).
- Manifesto diário `/backups/manifestos/uploads-<AAAAMMDD>.sha256` (`sha256sum` de cada arquivo) usado pelo teste de restauração.

### Cópia para fora do servidor

- `rsync -a -e "ssh -i /run/secrets/backup/id_ed25519 -o UserKnownHostsFile=/run/secrets/backup/known_hosts -o StrictHostKeyChecking=yes" /backups/{db,uploads,manifestos} "$BACKUP_REMOTE"/`, **sem** `--delete` (um servidor comprometido não apaga o histórico do destino; a retenção no destino é do órgão).
- `BACKUP_REMOTE` vazio: o backup local é feito e o script loga `level: "error"`, `evento: "backup.sem_copia_externa"` a cada execução.
- Falha de rede: código de saída diferente de zero e linha de log de erro; a próxima execução reenvia tudo o que faltou (rsync é incremental).

### Teste de restauração

- `docker/backup/testar-restauracao.sh [arquivo]` (padrão: o backup mais recente): confere o `.sha256`, descompacta em `/tmp`, roda `PRAGMA integrity_check`, compara a contagem por tabela com o `.json` do backup (tem de ser igual), confere que todo valor não nulo das colunas de anexo (`contratos.anexo`, `contratos.projetoBasico`, `anexos_fiscais.anexo`, `anexos_publicacao.anexo`, `penalidades.arquivo`, `pagamento_arquivos.arquivo`) existe em `/backups/uploads/` e começa com `%PDF-`, e confere o manifesto SHA-256 dos anexos. Sai `0` e loga `evento: "restauracao.teste.ok"` com as contagens; senão loga `restauracao.teste.falha` com o motivo.
- Agendado no cron do `backup` (domingo 03:30) e executado no CI sobre um banco gerado pelos testes (ver CI).
- Exercício manual trimestral descrito no runbook: restaurar o backup num servidor de homologação com `restaurar.sh` e abrir o sistema.

### Restauração

- `docker/backup/restaurar.sh <arquivo.db.gz>` (exige o serviço `app` parado; recusa se `/api/health` responde): confere SHA-256 e `integrity_check`, renomeia o banco atual para `app.db.antes-restauracao-<ts>`, apaga `app.db-journal`/`-wal`/`-shm` remanescentes, coloca o restaurado em `/data/app.db` com dono `node` (uid 1000) e `rsync -a /backups/uploads/ /data/uploads/` (sem `--delete`).
- O runbook encadeia: `docker compose stop app` → `docker compose run --rm backup restaurar.sh <arquivo>` → `docker compose start app` → esperar `healthy`.

### Atualização e rollback

- **Versão** = tag git (`vX.Y.Z`); a imagem é `detran-contratos:${APP_VERSION}` e o `.env` guarda a versão em uso.
- `scripts/ops/atualizar.sh <versao>` (no host, na pasta do repositório):
  1. `git fetch --tags && git checkout <versao>`;
  2. `docker compose run --rm backup backup.sh --motivo pre-atualizacao-<versao>` e grava o nome do arquivo e a versão anterior em `ops/ultima-atualizacao.env`;
  3. `APP_VERSION=<versao> docker compose build app`;
  4. atualiza `APP_VERSION` no `.env` e `docker compose up -d app` (o entrypoint valida o ambiente e roda `prisma migrate deploy`);
  5. espera `healthy` por até 180 s (`docker compose ps --format json`); se não ficar saudável, para e imprime o comando de rollback;
  6. smoke por `curl` através do proxy: `GET /login` `200`, `GET /api/contratos` sem sessão `401`, cabeçalhos `Strict-Transport-Security` e `Content-Security-Policy` presentes.
- `scripts/ops/rollback.sh`: lê `ops/ultima-atualizacao.env`, `docker compose stop app`, restaura o backup `pre-atualizacao-*` (`restaurar.sh`), volta `APP_VERSION` e o checkout para a versão anterior, `docker compose up -d app` (a imagem anterior ainda existe localmente; se não, `docker compose build app`), espera `healthy`.
- **Prisma não tem migração de descida**: voltar o código sem voltar o banco deixaria colunas novas que a versão antiga desconhece; por isso o rollback sempre restaura o backup pré-atualização. Dados gravados entre a atualização e o rollback se perdem — o runbook manda decidir o rollback na primeira hora e avisar os usuários.
- Imagens antigas: o runbook mantém as duas últimas (`docker image prune` com filtro de tag).

### Imagem

- `run` stage: `RUN chown -R node:node /app` e `USER node`; o volume `dados` passa a pertencer ao uid 1000 (o entrypoint falha com mensagem clara se `/app/data` não for gravável). Migração de volumes já existentes da 018: `docker compose run --rm --user root app chown -R 1000:1000 /app/data` (runbook).
- `LABEL org.opencontainers.image.version=$APP_VERSION` (build arg).
- `docker/entrypoint.sh`: `node check-env.js && prisma migrate deploy --schema ./prisma/schema.prisma && exec node server.js`.

### CI (GitHub Actions)

Entra nesta change porque a imagem de produção e o `openspec validate` são as garantias de que o que vai para o servidor foi testado. `.github/workflows/ci.yml`, em `push` e `pull_request`:

| Job | Passos |
|---|---|
| `verificar` (ubuntu-latest, Node 22) | `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build` → `npx -y @fission-ai/openspec@<versão fixada> validate --all --strict` (com `OPENSPEC_TELEMETRY=0`) |
| `imagem` (precisa de `verificar`) | `docker build --build-arg APP_VERSION=${{ github.sha }} .` → `docker build docker/backup` → `docker compose --env-file .env.example config -q` → sobe `app` + `backup` com `.env` de CI (HTTP interno), espera `healthy`, roda `backup.sh` e `testar-restauracao.sh` dentro do `backup` |

Sem segredos no CI (o `.env` de CI é gerado no job com valores descartáveis). Publicação de imagem e deploy ficam fora (CD).

### Runbook (`docs/operacao.md`)

Seções obrigatórias: 1. Requisitos do servidor (Docker ≥ 24, Compose v2, portas 80/443, disco: banco × 30 + anexos × 2); 2. Instalação (clonar a tag, `.env` a partir do `.env.example`, certificados em `certs/`, chave de backup em `secrets/backup/`, `docker compose up -d`); 3. Primeiro acesso (admin pelo `ADMIN_PASSWORD`, depois apagá-lo); 4. Carga do legado (aponta para o procedimento da 025: simulação, conferência, carga real); 5. Variáveis de ambiente (tabela acima); 6. Certificados e renovação; 7. Backup (o que, quando, onde, como conferir); 8. Restauração (passo a passo); 9. Teste de restauração e exercício trimestral; 10. Atualização; 11. Rollback; 12. Rotação do `AUTH_SECRET` (derruba todas as sessões) e da chave de backup; 13. Logs (onde ver, `docker compose logs`, filtros `jq`); 14. Solução de problemas (app `unhealthy`, `413`, certificado, disco cheio, prévia em iframe bloqueada).

## Risks / Trade-offs

- [Servidor único] → indisponibilidade durante atualização (segundos a minutos) e perda de até 24 h de dados se o disco morrer entre backups. Aceito pela decisão do autor; o RPO pode cair para horas mudando `BACKUP_HORARIO` sem mudar código.
- [`style-src 'unsafe-inline'`] → injeção de CSS continua possível; scripts inline exigem nonce. Mitigado por React escapar conteúdo e por não haver HTML de usuário renderizado.
- [CSP quebrando alguma tela] → o smoke e um teste por página com o navegador (checagem manual na task 3.5) antes de produção; o CSP é construído num único ponto (`security-headers.ts`).
- [Rollback perde dados gravados após a atualização] → backup obrigatório antes, decisão de rollback na primeira hora, aviso no runbook.
- [Healthcheck público dentro da rede] → responde só `status`; bloqueado no proxy; depende de confirmação do autor (Open Questions).
- [`rsync` sem `--delete` no destino] → o destino cresce sem limite; a retenção no destino é responsabilidade do órgão (Open Questions).
- [Certificado ACME numa intranet] → não emite sem DNS público; o runbook documenta o certificado do órgão como caminho padrão provável.
- [Volume da 018 com dono `root`] → app com `USER node` não grava; passo de `chown` no runbook e checagem no entrypoint.

## Open Questions

- **Exceção à diretiva de sessão (precisa do autor).** A diretiva diz que toda rota `/api` exige sessão, exceto `/login` e `/api/auth/*`. `GET /api/health` sem sessão é uma exceção nova (só status, bloqueado no proxy). Se o autor não aceitar, a alternativa pronta é: sem rota HTTP pública; o `healthcheck` do compose roda `node /app/healthcheck.js` dentro do container (`SELECT 1` pelo Prisma + `fs.access` da pasta), e o requisito "Healthcheck" muda de rota para script. O delta de `security` desta change sai junto.
- **Coordenação com a 023 no requisito "Login obrigatório".** O delta de `security` desta change copia o requisito de `openspec/specs/security/spec.md` atual. Na proposta da `023-perfis-acesso` lida em 13/11/2026, o delta de `security` só acrescenta requisitos (403 e download) e não altera este; se isso mudar, na hora de aplicar a 026 o bloco MODIFIED SHALL ser recopiado da spec já arquivada pela 023, acrescentando só a exceção do health.
- **Certificado**: o sistema será exposto só na intranet (certificado do órgão em `certs/`) ou na internet (ACME)? Qual o nome DNS?
- **Destino externo do backup**: qual servidor/serviço do DETRAN-RJ recebe o `rsync` (ou é um bucket S3 compatível, que trocaria `rsync` por `rclone`)? Qual a retenção lá? O backup precisa ser criptografado no destino?
- **Janela de manutenção** para atualizações e quem aprova o rollback.
- **Prévia em iframe em produção**: o ambiente de produção precisa abrir dentro de outra aplicação (`FRAME_ANCESTORS`)? O padrão proposto é não.
