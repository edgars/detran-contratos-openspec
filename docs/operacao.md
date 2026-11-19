# Operação em produção — DETRAN-RJ Contratos

Runbook do servidor único com Docker Compose e SQLite (decisão do autor de 13/11/2026; change `026-producao`).
Todos os comandos rodam **no servidor, na pasta do repositório** (onde está o `docker-compose.yml`), com um
usuário que pode usar o Docker. A stack tem quatro serviços:

| Serviço | O que faz | Portas no host |
|---|---|---|
| `proxy` | Caddy 2: HTTPS, redirecionamento HTTP → HTTPS, HSTS, limite de corpo, log de acesso JSON | 80 e 443 (as únicas) |
| `app` | Next.js (telas e API), SQLite em `/app/data/app.db`, anexos em `/app/data/uploads` (volume `dados`) | nenhuma |
| `backup` | backup diário 02:00, retenção, cópia externa por `rsync`/SSH, teste de restauração aos domingos 03:30 | nenhuma |
| `migrar` | carga do legado (perfil `migracao`, só sob demanda) | nenhuma |

Volumes: `dados` (banco e anexos), `backups` (cópias locais), `caddy_data` e `caddy_config` (certificados do Caddy).

## 1. Requisitos do servidor

- Linux x86-64 com Docker Engine ≥ 24 e o plugin Compose v2 (`docker compose version`).
- Portas 80 e 443 livres e liberadas no firewall para os usuários (e para a internet, se o certificado for ACME).
- Nome DNS do sistema (ex.: `contratos.detran.rj.gov.br`) apontando para o servidor.
- Disco: tamanho do banco × 30 (backups diários e mensais) + anexos × 2 (pasta e espelho), mais ~3 GB para as imagens.
- Acesso SSH de saída para o servidor de backup do órgão (destino do `BACKUP_REMOTE`).
- `curl` no servidor (usado por `scripts/ops/atualizar.sh`).

## 2. Instalação

1. Copie o repositório na versão a instalar (tag `vX.Y.Z`):
   ```bash
   git clone <url-do-repositorio> contratos && cd contratos
   git checkout vX.Y.Z
   ```
2. Crie o `.env` a partir do modelo e preencha a seção **Produção** (tabela da seção 5):
   ```bash
   cp .env.example .env
   chmod 600 .env
   openssl rand -base64 32          # cole em AUTH_SECRET
   ```
   No mínimo: `APP_VERSION=vX.Y.Z`, `SITE_ADDRESS`, `APP_ORIGIN=https://<SITE_ADDRESS>`, `AUTH_SECRET`,
   `CADDY_TLS`, `ADMIN_PASSWORD` (só para o primeiro acesso, seção 3) e `BACKUP_REMOTE`.
   Deixe `COOKIE_SECURE` vazio: em produção o app **não sobe** com `COOKIE_SECURE=false`.
3. Certificado (seção 6). Crie a pasta mesmo com ACME ou `internal` (`mkdir -p certs`; sem ela o Docker a cria como root).
   Com o certificado do órgão:
   ```bash
   mkdir -p certs && cp /caminho/fullchain.pem /caminho/privkey.pem certs/
   chmod 600 certs/privkey.pem
   ```
4. Chave do backup externo (seção 7):
   ```bash
   mkdir -p secrets/backup && chmod 700 secrets/backup
   ssh-keygen -t ed25519 -N "" -C backup-contratos -f secrets/backup/id_ed25519
   ssh-keyscan -p 22 srv-backup.detran > secrets/backup/known_hosts   # confira a impressão digital com a equipe do destino
   chmod 600 secrets/backup/*
   ```
   Entregue `secrets/backup/id_ed25519.pub` ao responsável pelo destino (vai no `authorized_keys` do usuário do backup).
   As pastas `certs/`, `secrets/` e `ops/` estão fora do git e da imagem (`.gitignore`, `.dockerignore`).
5. Suba a stack:
   ```bash
   docker compose up -d --build
   docker compose ps
   ```
   O `proxy` só sobe depois de o `app` ficar `healthy` (o primeiro start aplica as migrações; leva até 1 minuto).
   `docker compose ps` deve mostrar `app` e `backup` sem portas e `proxy` com `0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp`.
6. Confira de outro computador: `https://<SITE_ADDRESS>/login` abre a tela de login; `http://<SITE_ADDRESS>/` redireciona
   para HTTPS. No servidor:
   ```bash
   curl -sI https://<SITE_ADDRESS>/login | grep -i strict-transport-security
   curl -s -o /dev/null -w '%{http_code}\n' https://<SITE_ADDRESS>/api/contratos      # 401
   docker compose exec app id -u                                                       # 1000
   ```
   Smoke completo (cabeçalhos, login, telas e APIs):
   ```bash
   docker run --rm --network host -v "$PWD/scripts:/s:ro" -e BASE_URL=https://<SITE_ADDRESS> \
     -e SMOKE_USER=admin -e SMOKE_PASSWORD='<ADMIN_PASSWORD>' node:22-alpine node /s/smoke.mjs
   ```
   (Acrescente `-e SMOKE_INSECURE=1` só em homologação com `CADDY_TLS=internal`.)

**Servidor que já rodava a versão da 018** (app como `root`, porta 3000): o volume `dados` pertence ao root e o app
novo roda como `node` (uid 1000). Antes do primeiro `up` desta versão, corrija o dono uma vez:
```bash
docker compose stop app
docker compose run --rm --no-deps --user root --entrypoint chown app -R 1000:1000 /app/data
docker compose up -d --build
```
Sem isso o `app` termina com `entrypoint.dados_sem_permissao` no log.

## 3. Primeiro acesso

1. Com `ADMIN_USERNAME`/`ADMIN_PASSWORD` no `.env` e a tabela de usuários vazia, entre em `https://<SITE_ADDRESS>/login`
   com esse usuário: o app cria o administrador no primeiro login (perfil Administrador).
2. Troque a senha em **Minha conta › Trocar senha** e crie os usuários e perfis em **Usuários**.
3. **Apague o valor de `ADMIN_PASSWORD` do `.env`** e recrie o app: `docker compose up -d app`.
   Enquanto ele estiver preenchido, o app registra `env.aviso` no log a cada start.

## 4. Carga do legado

Procedimento da `025-migracao-legado`. A pasta `./import/` fica ao lado do `docker-compose.yml` e está no
`.gitignore` e no `.dockerignore` (dados pessoais: nunca versionar).

1. **Pedir o dump ao DETRAN-RJ.** Um arquivo por banco, gerado no servidor MySQL do legado:
   ```
   mysqldump --single-transaction --default-character-set=utf8mb4 --hex-blob contratos > contratos.sql
   mysqldump --single-transaction --default-character-set=utf8mb4 --hex-blob global diretorias departamentos pessoas_fisicas prestadores_servicos pessoas > global.sql
   ```
   Pedir também a confirmação da codificação dos bancos (`latin1` ou `utf8`) e anotar a data e a hora do dump.
2. **Copiar os anexos do servidor antigo.** Copiar a(s) pasta(s) de PDFs do servidor antigo (`rsync -a` ou mídia) para
   `./import/anexos/`; a estrutura interna não importa (o carregador procura pelo nome do arquivo, sem diferenciar
   maiúsculas). Copiar `contratos.sql` e `global.sql` para `./import/`.
3. **Construir o carregador:** `docker compose --profile migracao build migrar`.
4. **Simular** (quantas vezes for preciso; nada é gravado, nenhum arquivo é copiado, não precisa parar o app):
   ```
   docker compose --profile migracao run --rm migrar --origem /import/contratos.sql --origem /import/global.sql --anexos /import/anexos --simular
   ```
   Código 1 = abortada (ex.: o dump não bate com `src/lib/migracao/mapa.ts`: a mensagem lista `banco.tabela.coluna`
   esperadas e as colunas encontradas — ajustar o mapa, o teste do mapa e repetir); se a mensagem pedir, repetir com
   `--encoding latin1`. Código 2 = concluída com rejeições; código 0 = sem rejeições.
5. **Conferir o relatório** (`data/migracao/relatorio-<data-hora>-simulacao.json` no volume, e o resumo no terminal):
   - contagens por tabela (lidas = inseridas + atualizadas + inalteradas + rejeitadas + não carregadas);
   - `somatorios`: conferir com o **financeiro** os totais de `contratos.valorTotal`, `valorInicial`, `valorMensal`,
     `pagamentos.valor` e `valorGlosa` (origem × origem arredondada × destino; a diferença tem de ser `0.00`) e a lista
     de `arredondamentos`;
   - `rejeitados` (com motivo), `avisos` (CPF/CNPJ sem referência, DV inválido, anexos ausentes/inválidos, pendências
     de cadastro com a chave `RK-…`), `colunasIgnoradas`, `usuarios.gruposSemMapeamento`.
   Para copiar o relatório para fora do volume:
   `docker compose run --rm --no-deps -T backup sh -c 'cat /data/migracao/relatorio-*-simulacao.json' > relatorio-simulacao.json`.
   Decidir com o gestor do sistema se as rejeições são aceitas ou se o legado será corrigido e um novo dump pedido.
6. **Carga real, com o app parado** (antes da virada):
   ```
   docker compose stop app
   docker compose --profile migracao run --rm migrar --origem /import/contratos.sql --origem /import/global.sql --anexos /import/anexos --confirmar
   docker compose start app
   ```
   A carga recusa se houver sessão criada nos últimos 5 minutos, se o banco já tiver contratos, pagamentos ou fiscais
   sem carga anterior, ou se o backup falhar. Antes de gravar, faz `data/backups/pre-migracao-<data-hora>.db`; o
   `backup.sh` seguinte comprime esse arquivo, move-o para `/backups/db/` e o inclui na retenção (90 dias) e na cópia
   externa. A carga é uma transação única (falhou → nada gravado, arquivos copiados apagados). Ao fim, roda o
   resolvedor de gestores da 022 e anexa a saída ao relatório. Rodar de novo com o mesmo dump não muda nada; com um
   dump mais novo (ainda antes da virada) atualiza o que mudou e lista em `existentesForaDoDump` o que sumiu, sem
   apagar. **Depois da virada, não recarregar** (sobrescreveria edições feitas no app).
7. **Ativar os usuários.** Nenhuma senha do legado é migrada: os usuários entram inativos e marcados para redefinição
   (lista em `usuarios.precisamDeSenha` do relatório). Um Administrador abre **Usuários › Editar › Definir senha**
   (`/users/<id>/senha`) para cada um, informa a senha e a confirmação e entrega a senha ao usuário; ao salvar, o
   usuário fica ativo. Usuários técnicos: `legado.desconhecido` (autor de penalidades/prestação de contas cujo usuário
   sumiu do legado) fica inativo.
8. **Limpar**: apagar `./import/` do servidor depois da conferência (dados pessoais), mantendo o relatório e o backup
   `pre-migracao-*`. Rode um backup manual em seguida: `docker compose exec backup backup.sh --motivo pos-carga`.

## 5. Variáveis de ambiente

Todas no `.env` (modelo comentado em `.env.example`). Em produção o app valida a configuração antes de aplicar
migrações (`check-env.js` no entrypoint e `src/instrumentation.ts`): variável inválida → o container termina com a
lista dos **nomes** das variáveis (nunca os valores) e nenhuma migração é aplicada.

| Variável | Serviço | Exemplo / padrão | Obrigatória |
|---|---|---|---|
| `APP_VERSION` | compose (`app`, `backup`) | `v1.0.0` (tag git) | sim |
| `SITE_ADDRESS` | `proxy` | `contratos.detran.rj.gov.br` | sim |
| `CADDY_TLS` | `proxy` | `/certs/fullchain.pem /certs/privkey.pem`, e-mail ou `internal` | sim |
| `ACME_EMAIL` | `proxy` | e-mail técnico do órgão | só com ACME |
| `PROXY_MAX_BODY_MB` | `proxy`, `app` | `11` (maior que `UPLOAD_MAX_MB`, no máximo 100; em MiB) | sim |
| `APP_ORIGIN` | `app` | `https://contratos.detran.rj.gov.br` | sim |
| `AUTH_SECRET` | `app` | `openssl rand -base64 32` (≥ 32 bytes) | sim |
| `DATABASE_URL` | `app` (fixo no compose) | `file:/app/data/app.db` | — |
| `UPLOAD_DIR` | `app` (fixo no compose) | `/app/data/uploads` | — |
| `UPLOAD_MAX_MB` | `app` | `10` | sim |
| `COOKIE_SECURE` | `app` | vazio (proibido `false` em produção) | não |
| `COOKIE_SAMESITE` | `app` | vazio; `none` só para prévia em iframe | não |
| `FRAME_ANCESTORS` | `app` | vazio; origens `https://` da prévia, separadas por espaço | não |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `app` | só no primeiro acesso; apagar a senha depois | não |
| `LOG_LEVEL` | `app` | `info` (`debug`, `info`, `warn`, `error`) | não |
| `TZ` | `backup` | `America/Sao_Paulo` (o app fica em UTC) | sim |
| `BACKUP_HORARIO` | `backup` | `0 2 * * *` | não |
| `BACKUP_RETENCAO_DIARIA` | `backup` | `14` | não |
| `BACKUP_RETENCAO_MENSAL` | `backup` | `6` | não |
| `BACKUP_REMOTE` | `backup` | `backup@srv-backup.detran:/backups/contratos` | sim em produção (vazio só gera erro no log) |
| `BACKUP_SSH_PORTA` | `backup` | vazio (22) | não |
| `CERTS_DIR` / `BACKUP_SECRETS_DIR` | compose | `./certs` / `./secrets/backup` | não |
| `ENV_FILE` | compose | `.env` (arquivo lido pelos serviços) | não |

Depois de mudar o `.env`: `docker compose up -d` (recria só os serviços afetados).

## 6. Certificados e renovação

- **Certificado do órgão** (intranet; caminho padrão provável): `CADDY_TLS="/certs/fullchain.pem /certs/privkey.pem"`,
  arquivos em `./certs/` (cadeia completa no `fullchain.pem`). Renovação: substitua os dois arquivos e rode
  `docker compose exec proxy caddy reload --config /etc/caddy/Caddyfile` (ou `docker compose restart proxy`).
  Confira a validade: `echo | openssl s_client -connect <SITE_ADDRESS>:443 -servername <SITE_ADDRESS> 2>/dev/null | openssl x509 -noout -enddate`.
- **ACME automático** (sistema exposto na internet, DNS público e portas 80/443 abertas): `CADDY_TLS=<e-mail>` e
  `ACME_EMAIL=<e-mail>`. O Caddy emite e renova sozinho; os certificados ficam no volume `caddy_data` (não o apague).
- **`internal`**: CA própria do Caddy, só para homologação (os navegadores mostram alerta).
- HSTS é `max-age=31536000` sem `includeSubDomains`: depois de um acesso por HTTPS o navegador recusa HTTP por um ano.

## 7. Backup

| O quê | Quando | Onde |
|---|---|---|
| Banco: `sqlite3 .backup` (online), `PRAGMA integrity_check`, contagens por tabela e última migração em `.json`, `gzip -9` e `.sha256` | diário em `BACKUP_HORARIO` (02:00) | volume `backups`: `/backups/db/app-AAAAMMDD-HHMMSS[-motivo].db.gz` |
| Anexos: espelho incremental **sem** apagar o que saiu do app + manifesto SHA-256 do dia | junto do banco | `/backups/uploads/`, `/backups/manifestos/uploads-AAAAMMDD.sha256` |
| Backups `pre-migracao-*.db` da carga do legado | no backup seguinte à carga | comprimidos para `/backups/db/` |
| Cópia externa: `rsync` sobre SSH de `db/`, `uploads/` e `manifestos/`, **sem** `--delete` | depois de cada backup | `BACKUP_REMOTE` |

Retenção local: os 14 diários mais recentes, o primeiro de cada um dos últimos 6 meses, e os backups com motivo
(`pre-atualizacao-*`, `pre-migracao-*`, `manual`…) por 90 dias. Se o backup do dia falhar, nada é apagado. No destino
externo a retenção é do órgão (o `rsync` não apaga lá).

Backup sob demanda (app no ar): `docker compose exec backup backup.sh --motivo manual`.
Códigos de saída do `backup.sh`: `0` ok; `1` backup falhou (nada substituído); `3` backup local ok **sem cópia externa**
(`BACKUP_REMOTE` vazio ou destino fora do ar — o próximo backup reenvia o que faltou).

Como conferir:
```bash
docker compose exec backup ls -lh /backups/db | tail
docker compose exec backup crontab -l
docker compose logs backup | grep -E '"evento":"backup\.(banco\.ok|copia_externa|sem_copia_externa|integridade)'
```
Um dia sem `backup.copia_externa.ok` no log é incidente: veja a seção 14.

## 8. Restauração

Use para voltar o banco e os anexos a um backup (disco corrompido, erro operacional, rollback).
**Os dados gravados depois do backup escolhido se perdem**: avise os usuários.

```bash
docker compose exec backup ls -1 /backups/db            # escolha o arquivo .db.gz
docker compose stop app
docker compose run --rm --no-deps backup restaurar.sh app-AAAAMMDD-HHMMSS.db.gz
docker compose start app
docker compose ps app                                   # espere "healthy"
```
O `restaurar.sh` recusa se o app estiver respondendo, confere SHA-256 e `integrity_check`, guarda o banco atual como
`/app/data/app.db.antes-restauracao-<data>` (apague-o depois de conferir), repõe o banco com dono uid 1000 e copia
os anexos do espelho (sem apagar os que existem). Para restaurar de um servidor novo, copie antes os arquivos do
destino externo (`BACKUP_REMOTE`) para o volume `backups`:
```bash
docker compose run --rm --no-deps -v /caminho/copiado:/origem:ro backup sh -c 'cp -a /origem/db /origem/uploads /origem/manifestos /backups/'
```

## 9. Teste de restauração e exercício trimestral

- **Automático**: todo domingo 03:30 o `backup` roda `testar-restauracao.sh` sobre o backup mais recente: SHA-256,
  `integrity_check`, contagens iguais às do `.json`, todo anexo referenciado pelo banco presente no espelho e
  começando com `%PDF-`, manifesto dos anexos. Resultado no log:
  `docker compose logs backup | grep restauracao.teste` → `restauracao.teste.ok` (com as contagens) ou
  `restauracao.teste.falha` (com o motivo: tabela, id e arquivo).
- **Sob demanda**: `docker compose exec backup testar-restauracao.sh [arquivo.db.gz]`.
- **Exercício trimestral** (registrar data e responsável): num servidor de homologação, instale a mesma versão
  (seção 2, com `CADDY_TLS=internal`), copie os backups do destino externo para o volume `backups` (seção 8), rode
  `restaurar.sh` com o backup mais recente, suba o app e abra o sistema: confira uns contratos e abra um anexo.

## 10. Atualização

Combine a janela com os usuários (o sistema fica fora do ar de segundos a minutos) e rode:
```bash
scripts/ops/atualizar.sh vX.Y.Z
```
O script: `git fetch --tags && git checkout vX.Y.Z` → backup `pre-atualizacao-vX.Y.Z` (grava a versão anterior e o
backup em `ops/ultima-atualizacao.env`) → constrói `detran-contratos:vX.Y.Z` → grava `APP_VERSION` no `.env` e sobe o
app (o entrypoint valida o ambiente e roda `prisma migrate deploy`) → espera `healthy` por até 180 s → smoke pelo proxy
(`/login` 200, `/api/contratos` sem sessão 401, HSTS e CSP presentes) → recria `backup` e `proxy`. Qualquer falha para
o script e mostra o comando de rollback. Em homologação com `CADDY_TLS=internal`, use `SMOKE_INSECURE=1 scripts/ops/atualizar.sh …`.

Imagens antigas: mantenha as duas últimas versões (a anterior é a do rollback). Para apagar as outras:
```bash
docker image ls detran-contratos
docker image rm detran-contratos:vA.B.C detran-contratos-backup:vA.B.C
```

## 11. Rollback

Decida na **primeira hora** depois da atualização (os dados gravados depois dela se perdem) e avise os usuários:
```bash
scripts/ops/rollback.sh
```
O script lê `ops/ultima-atualizacao.env`, para o app, restaura o backup `pre-atualizacao-*` (o Prisma não tem migração
de descida: voltar o código sem voltar o banco deixaria colunas que a versão antiga desconhece), volta o checkout e
`APP_VERSION` para a versão anterior, sobe a imagem anterior (constrói se ela não existir mais) e espera `healthy`.

## 12. Rotação de segredos

- **`AUTH_SECRET`** (suspeita de vazamento ou rotina anual): gere outro (`openssl rand -base64 32`), troque no `.env`
  e rode `docker compose up -d app`. **Todas as sessões caem** (todos precisam entrar de novo).
- **Chave do backup**: gere uma nova (`ssh-keygen -t ed25519 -N "" -f secrets/backup/id_ed25519.nova`), peça ao
  responsável pelo destino para incluir a `.pub` nova, troque os arquivos (`mv secrets/backup/id_ed25519.nova
  secrets/backup/id_ed25519` e o mesmo para a `.pub`), rode `docker compose exec backup backup.sh --motivo teste-chave`
  (código 0 e `backup.copia_externa.ok`) e só então peça a remoção da chave antiga no destino.
- **Senhas de usuários**: pela tela **Usuários › Definir senha** (Administrador).

## 13. Logs

- App, backup e proxy escrevem **uma linha JSON por evento** em stdout; o Docker guarda 10 MB × 5 arquivos por serviço.
- Eventos do app: `login.ok`, `login.falha` (só o usuário digitado), `logout`, `sessao.invalida` (401), `acesso.negado`
  (403), `upload.recusado`, `erro.interno` (500, com rota e método), `health` (healthcheck com falha), `env.aviso`,
  `env.invalido`. Nenhuma linha leva senha, hash, cookie, token ou o `AUTH_SECRET`. `LOG_LEVEL=debug` inclui a pilha
  dos erros.
- Proxy: log de acesso do Caddy (método, caminho, status, duração, IP), sem `Cookie`, `Authorization` e `Set-Cookie`.
- Backup: `backup.*`, `restauracao.*`.

```bash
docker compose logs -f app
docker compose logs --no-log-prefix --since 24h app | grep '^{' | jq -c 'select(.level=="error")'
docker compose logs --no-log-prefix --since 1h app | grep '^{' | jq -c 'select(.evento=="login.falha") | {ts, username}'
docker compose logs --no-log-prefix proxy | grep '^{' | jq -c 'select(.status>=500) | {ts, status, uri: .request.uri}'
docker compose logs --no-log-prefix backup | grep '^{' | jq -c 'select(.servico=="backup") | {ts, level, evento}'
```
Monitoramento e alertas externos ficam com o órgão: ligue o coletor de logs do Docker (`json-file`) e alerte em
`level=error`, em `backup.sem_copia_externa`/`backup.copia_externa.falha` e em `restauracao.teste.falha`.

## 14. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `app` fica `unhealthy` ou reiniciando | configuração inválida, volume sem permissão, banco ilegível ou disco cheio | `docker compose logs --tail 50 app`: `env.invalido` lista as variáveis (corrija o `.env`); `entrypoint.dados_sem_permissao` → `chown` da seção 2; `health` com erro do SQLite → verifique o disco e, se preciso, restaure (seção 8) |
| `proxy` não sobe (`dependency failed to start`) | o `app` não ficou `healthy` | resolva o `app` primeiro; depois `docker compose up -d` |
| Upload devolve `413` (ou, em HTTP/2, a conexão do envio é encerrada) | arquivo maior que `PROXY_MAX_BODY_MB` | é o limite esperado; para aumentar, suba `UPLOAD_MAX_MB` e `PROXY_MAX_BODY_MB` juntos (proxy maior que o app, no máximo 100) e `docker compose up -d` |
| Upload devolve "O arquivo passa do limite de N MB" | arquivo entre `UPLOAD_MAX_MB` e `PROXY_MAX_BODY_MB` | limite do app; mesmo procedimento acima |
| Navegador alerta certificado | certificado vencido, cadeia incompleta ou `CADDY_TLS=internal` | `docker compose logs proxy | grep -i tls`; confira `fullchain.pem` (cadeia completa) e a validade (seção 6) |
| ACME não emite | sem DNS público ou portas 80/443 fechadas para a internet | use o certificado do órgão |
| Disco cheio | backups locais, logs, imagens antigas | `df -h`; `docker system df`; apague imagens de versões antigas (seção 10); reduza `BACKUP_RETENCAO_*`; nunca apague o volume `dados` |
| `backup.sem_copia_externa` ou `backup.copia_externa.falha` | `BACKUP_REMOTE` vazio, destino fora do ar, chave ou `known_hosts` errados | teste: `docker compose exec backup ssh -i /run/secrets/backup/id_ed25519 -o UserKnownHostsFile=/run/secrets/backup/known_hosts -o StrictHostKeyChecking=yes <usuario@destino> true`; o backup seguinte reenvia o que faltou |
| Prévia em iframe bloqueada | `FRAME_ANCESTORS` vazio (padrão: `X-Frame-Options: SAMEORIGIN`) | só se a prévia for autorizada: `FRAME_ANCESTORS="https://origem.da.previa"` e `COOKIE_SAMESITE=none`, `docker compose up -d app` |
| Todos foram deslogados | `AUTH_SECRET` trocado | esperado (seção 12) |
| `restaurar.sh` recusa | o app está no ar | `docker compose stop app` antes |
