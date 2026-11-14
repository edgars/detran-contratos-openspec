# Tasks

## 0. Pré-condições

- [ ] 0.1 Confirmar com o autor a exceção `GET /api/health` à diretiva de sessão (design.md › Open Questions). Sem confirmação: trocar o healthcheck pela alternativa por script (`node /app/healthcheck.js`), remover `specs/security/` desta change e ajustar o requisito "Healthcheck" antes de implementar. Verificação: resposta do autor registrada em design.md › Decisions.
- [ ] 0.2 Se a `023-perfis-acesso` arquivada alterou o requisito "Login obrigatório", recopiar o bloco de `openspec/specs/security/spec.md` em `specs/security/spec.md` desta change, acrescentando só a exceção do health (o detalhe do health fica no requisito ADDED *Healthcheck sem sessão restrito*). Verificação: `diff` entre o requisito arquivado e o desta change mostra só a exceção; `openspec validate 026-producao --strict` passa.

## 1. Configuração validada e cookie

- [ ] 1.1 Criar `src/lib/env.ts` com o schema `zod` das variáveis de produção (design.md › Configuração validada no start) e `check-env` executável (`src/lib/env-cli.ts` empacotado como `check-env.js` no standalone). Verificação: `tests/producao-env.test.ts` cobre cada regra (um caso inválido por variável e um válido) e confere que a mensagem tem o nome e não o valor.
- [ ] 1.2 Criar `src/instrumentation.ts` chamando a validação em `register()` e alterar `docker/entrypoint.sh` para `node check-env.js` antes de `prisma migrate deploy`, falhando também se `/app/data` não for gravável. Verificação: `docker compose run --rm -e COOKIE_SECURE=false app` termina com código ≠ 0 citando `COOKIE_SECURE`, e `sqlite3 data/app.db "select count(*) from _prisma_migrations"` não muda (cenário *Cookie inseguro em produção*).
- [ ] 1.3 Teste do cenário *Login em produção*: com `NODE_ENV=production`, `POST /api/auth/login` devolve `Set-Cookie` com `Secure`, `HttpOnly`, `SameSite=Lax`. Verificação: `tests/producao-cookie.test.ts`.

## 2. Cabeçalhos de segurança

- [ ] 2.1 Criar `src/lib/security-headers.ts` (`securityHeaders({ nonce, frameAncestors })`) com a tabela de design.md › Cabeçalhos de segurança. Verificação: `tests/producao-headers.test.ts` (unitário) confere cada cabeçalho, `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` sem `FRAME_ANCESTORS`, e `frame-ancestors 'self' https://previa.exemplo` sem `X-Frame-Options` com a variável.
- [ ] 2.2 Alterar `src/middleware.ts`: gerar nonce (16 bytes, `crypto.getRandomValues`), repassar `x-nonce` na requisição e aplicar os cabeçalhos em toda resposta, inclusive `401` e redirecionamentos. Verificação: testes dos cenários *Cabeçalhos numa página*, *Nonce por requisição* e *Resposta 401 também protegida* chamando `middleware()` com `NextRequest`.
- [ ] 2.3 Alterar `src/app/layout.tsx` para ler `x-nonce` (`headers()`) e passar `nonce` ao `ThemeProvider` (`src/components/theme-provider.tsx` repassa ao `next-themes`). Verificação: `npm run build && npm start` com `NODE_ENV=production`; abrir `/login`, `/contratos`, `/contratos/new` e uma página de cada entidade no Chrome com o console aberto: nenhuma violação de CSP (checagem manual registrada no PR).
- [ ] 2.4 Atualizar `scripts/smoke.mjs` para conferir os cabeçalhos de 2.1 em `/login` e numa resposta `401`. Verificação: `npm run smoke` passa contra o build de produção.
- [ ] 2.5 Checagem manual do cenário *Prévia autorizada*: com `FRAME_ANCESTORS` e `COOKIE_SAMESITE=none`, abrir o sistema num iframe da origem configurada e logar. Verificação: registrado no PR com captura de tela.

## 3. Healthcheck e logs

- [ ] 3.1 Criar `src/app/api/health/route.ts` (`SELECT 1` por `$queryRaw` com template tag + `fs.access(uploadDir(), W_OK)`, `200`/`503`, só `status`) e a exceção exata `GET /api/health` em `isPublicPath` (`src/middleware.ts`). Verificação: `tests/producao-health.test.ts` com os cenários *Saudável*, *Banco indisponível* (Prisma mockado para lançar) e *Outras rotas continuam protegidas* (`POST /api/health` e `GET /api/healthz` → `401`), e os cenários *Healthcheck sem sessão* / *Outro método no healthcheck* do requisito *Healthcheck sem sessão restrito* de `specs/security/spec.md`.
- [ ] 3.2 Criar `src/lib/log.ts` (JSON por linha, `LOG_LEVEL`, remoção recursiva das chaves proibidas de design.md › Logs estruturados). Verificação: `tests/producao-log.test.ts` loga um objeto com `password`, `passwordHash`, `cookie`, `token` aninhados e confere que nenhum aparece na saída.
- [ ] 3.3 Emitir os eventos `login.ok`, `login.falha`, `logout` (`src/app/api/auth/login/route.ts`, `logout/route.ts`), `sessao.invalida` (`src/middleware.ts`), `upload.recusado` (`src/lib/uploads.ts`), `erro.interno` (`src/lib/api/http.ts`), `acesso.negado` (ponto de autorização da 023). Verificação: testes dos cenários *Falha de login* (captura de `process.stdout.write`, confere `username` e ausência da senha) e *Erro interno*.

## 4. Proxy e compose

- [ ] 4.1 Criar `docker/caddy/Caddyfile` como em design.md › Proxy reverso. Verificação: `docker run --rm -v $PWD/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro -e SITE_ADDRESS=localhost -e CADDY_TLS=internal -e PROXY_MAX_BODY_MB=11 -e ACME_EMAIL=x@exemplo caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile` passa.
- [ ] 4.2 Reescrever `docker-compose.yml` com a topologia de design.md (serviços `proxy`, `app`, `backup`; rede `interna`; volumes `dados`, `backups`, `caddy_data`, `caddy_config`; `healthcheck` do app; `depends_on` com `service_healthy`; âncora `x-logging`; `app` sem `ports`), preservando o serviço `migrar` da 025 no perfil `migracao`. Verificação: `docker compose --env-file .env.example config -q` passa; cenário *Só o proxy exposto* e cenário *App ainda iniciando* (requisito *Proxy espera o app saudável*) com `docker compose ps`.
- [ ] 4.3 Verificar no ambiente local (`SITE_ADDRESS=localhost`, `CADDY_TLS=internal`) os cenários *Acesso por HTTP* (`curl -sI http://localhost/login` → `308` para HTTPS), *HSTS* (`curl -skI https://localhost/login`), *Porta do app fechada* (`curl http://localhost:3000` recusado), *Chamado de fora* (`curl -sk https://localhost/api/health` → `404`) e *Primeiro start* da spec `deployment`. Verificação: saídas dos comandos coladas no PR.
- [ ] 4.4 Cenários *Arquivo grande demais* e *Arquivo entre os limites*: `curl -sk -F anexo=@20mb.pdf` → `413` e nenhum arquivo novo em `/app/data/uploads`; PDF de 10,5 MB → mensagem de limite do app. Verificação: comandos e saídas no PR.
- [ ] 4.5 Cenário *Log de acesso do proxy*: navegar logado e rodar `docker compose logs proxy | grep -ci cookie` → `0`. Verificação: saída no PR.

## 5. Imagem

- [ ] 5.1 Alterar o `Dockerfile`: `ARG APP_VERSION`, `LABEL org.opencontainers.image.version`, `chown -R node:node /app`, `USER node`, copiar `check-env.js`. Verificação: `docker compose exec app id -u` → `1000` (cenário *Usuário do processo*); `docker history` sem segredo (requisito "Sem segredo em imagem" da 018 continua valendo).
- [ ] 5.2 `.dockerignore` e `.gitignore` ganham `secrets/`, `certs/`, `ops/`. Verificação: `docker build` com arquivos fictícios nessas pastas e `docker run --rm --entrypoint ls detran-contratos:<tag> /app` não os mostra.

## 6. Backup e restauração

- [ ] 6.1 Criar `docker/backup/Dockerfile` (alpine + `sqlite`, `rsync`, `openssh-client`, `tzdata`, `coreutils`) e `docker/backup/crontab` (backup em `BACKUP_HORARIO`, teste de restauração domingo 03:30, crond em primeiro plano). Verificação: `docker compose build backup` e `docker compose exec backup crontab -l`.
- [ ] 6.2 Criar `docker/backup/backup.sh` (`.backup`, `integrity_check`, `.json` de contagens e migração, `gzip`, `.sha256`, espelho de anexos, manifesto, retenção, cópia externa, logs JSON). Verificação: com o app recebendo gravações (`npm run smoke` em laço), `docker compose run --rm backup backup.sh --motivo manual` gera os três arquivos e `integrity_check` `ok` (cenários *Backup com o app gravando* e *Anexo novo*).
- [ ] 6.3 Criar `docker/backup/retencao.sh` com a regra de design.md. Verificação: script de teste `docker/backup/testes/retencao.test.sh` cria 40 arquivos datados em 3 meses e 2 com motivo, roda a retenção e confere os que sobram (cenário *Retenção*); roda dentro do container `backup` no CI.
- [ ] 6.4 Cenário *Cópia corrompida*: `docker/backup/testes/corrompido.test.sh` substitui o `sqlite3` por um stub que devolve erro no `integrity_check`; o script sai ≠ 0 e nenhum backup anterior some. Verificação: roda no CI.
- [ ] 6.5 Cópia externa: no ambiente local, um container `sshd` de teste (`docker/backup/testes/compose.remoto.yml`) como `BACKUP_REMOTE`. Verificação: cenários *Envio normal* (arquivos no destino) e *Destino fora do ar* (container parado → log `backup.copia_externa.falha`, código ≠ 0; ao religar, a execução seguinte envia o que faltou).
- [ ] 6.6 Criar `docker/backup/testar-restauracao.sh`. Verificação: cenários *Backup íntegro* e *Anexo faltando* (apagar um PDF do espelho antes de rodar), via `docker compose run --rm backup testar-restauracao.sh`.
- [ ] 6.7 Criar `docker/backup/restaurar.sh`. Verificação: cenários *Restaurar um backup* (criar registro, backup, apagar registro, restaurar, conferir que voltou e que existe `app.db.antes-restauracao-*`) e *App no ar* (recusa com o app rodando).

## 7. Atualização e rollback

- [ ] 7.1 Criar `scripts/ops/atualizar.sh` (passos de design.md › Atualização e rollback, `ops/ultima-atualizacao.env`). Verificação: num clone local, criar tags `v0.0.1-teste` e `v0.0.2-teste` (a segunda com uma migração vazia de teste), atualizar de uma para a outra e conferir o cenário *Atualização com migração nova*.
- [ ] 7.2 Cenário *Versão que não fica saudável*: tag de teste cujo `entrypoint` sai com erro. Verificação: o script termina ≠ 0 em até 180 s e imprime o comando de rollback.
- [ ] 7.3 Criar `scripts/ops/rollback.sh`. Verificação: depois de 7.1, `rollback.sh` volta para `v0.0.1-teste` e `_prisma_migrations` não tem a migração de teste (cenário *Voltar uma versão*). Apagar as tags de teste no fim.

## 8. CI

- [ ] 8.1 Criar `.github/workflows/ci.yml` com os jobs `verificar` e `imagem` de design.md › CI (versão do `@fission-ai/openspec` fixada; `OPENSPEC_TELEMETRY=0`; `.env` de CI gerado no job). Verificação: `npx -y @action-validator/cli .github/workflows/ci.yml` (ou `actionlint`) sem erro; execução no GitHub verde num PR (cenário *Pull request válido*).
- [ ] 8.2 Cenário *Pull request com teste quebrado*: num branch descartável, um teste falhando faz `verificar` falhar e `imagem` não rodar. Verificação: link da execução no PR; branch apagado depois.

## 9. Ambiente e runbook

- [ ] 9.1 Acrescentar a seção "Produção" ao `.env.example` com todas as variáveis da tabela de design.md, sem valores secretos. Verificação: `tests/producao-env.test.ts` lê `.env.example` e confere que toda variável lida por `src/lib/env.ts`, pelo `Caddyfile` e pelos scripts de backup está documentada.
- [ ] 9.2 Escrever `docs/operacao.md` com as 14 seções de design.md › Runbook, incluindo a migração de dono do volume da 018 (`chown -R 1000:1000`) e a carga do legado (procedimento da 025). Verificação: cenário *Instalação do zero* executado numa VM limpa (ou `docker-in-docker`) seguindo só o runbook; comandos que falharam corrigidos no texto.
- [ ] 9.3 Link para `docs/operacao.md` no `README.md`. Verificação: checagem manual do link.

## 10. Verificação final

- [ ] 10.1 Um teste automatizado ou verificação registrada por `#### Scenario:` de `specs/producao/spec.md`, `specs/deployment/spec.md` e `specs/security/spec.md`. Verificação: lista cenário → teste/comando no PR.
- [ ] 10.2 `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` e `OPENSPEC_TELEMETRY=0 npx -y @fission-ai/openspec@latest validate 026-producao --strict` passam.
