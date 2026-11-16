# Spec Delta

## Purpose

Operação em produção num único servidor com Docker Compose e SQLite (decisão do autor, 13/11/2026): o sistema SHALL ser servido só por HTTPS, com cabeçalhos de segurança, configuração validada, healthcheck, logs estruturados sem segredos, backup diário do banco e dos anexos com cópia fora do servidor, restauração testada, atualização com rollback, CI e runbook.

## ADDED Requirements

### Requirement: HTTPS obrigatório pelo proxy
O sistema SHALL ser acessado só pelo proxy reverso Caddy (`proxy`), único serviço com portas publicadas (80 e 443). O proxy SHALL redirecionar HTTP para HTTPS, SHALL enviar `Strict-Transport-Security: max-age=31536000` e SHALL encaminhar as requisições ao serviço `app` pela rede interna do compose. O serviço `app` SHALL NOT publicar porta no host.

#### Scenario: Acesso por HTTP
- **WHEN** um navegador pede `http://<SITE_ADDRESS>/login`
- **THEN** recebe um redirecionamento permanente para `https://<SITE_ADDRESS>/login`

#### Scenario: Porta do app fechada
- **GIVEN** a stack de produção no ar
- **WHEN** o operador consulta `docker compose ps` e tenta `http://<servidor>:3000/`
- **THEN** só o serviço `proxy` aparece com portas publicadas (80 e 443) e a conexão na porta 3000 é recusada

#### Scenario: HSTS
- **WHEN** uma página é pedida por HTTPS
- **THEN** a resposta traz `Strict-Transport-Security: max-age=31536000`

### Requirement: Configuração de produção validada no start
Com `NODE_ENV=production`, o app SHALL recusar o start (saída diferente de zero, antes de `prisma migrate deploy`) quando uma variável de produção for inválida segundo a tabela de design.md › Configuração validada no start (`AUTH_SECRET` com menos de 32 bytes, `APP_ORIGIN` sem `https://`, `COOKIE_SECURE=false`, `PROXY_MAX_BODY_MB` não maior que `UPLOAD_MAX_MB`, entre outras). A mensagem SHALL citar o nome de cada variável inválida e SHALL NOT exibir o valor.

#### Scenario: Cookie inseguro em produção
- **GIVEN** `NODE_ENV=production` e `COOKIE_SECURE=false`
- **WHEN** o container `app` inicia
- **THEN** o processo termina com erro citando `COOKIE_SECURE` e nenhuma migração é aplicada

#### Scenario: Segredo fraco
- **GIVEN** `AUTH_SECRET` com 10 caracteres
- **WHEN** o container `app` inicia
- **THEN** o processo termina com erro citando `AUTH_SECRET` e a saída não contém o valor do segredo

#### Scenario: Configuração válida
- **GIVEN** todas as variáveis obrigatórias válidas
- **WHEN** o container `app` inicia
- **THEN** as migrações são aplicadas e o servidor sobe

### Requirement: Cookie de sessão seguro em produção
Em produção, o cookie de sessão SHALL ser emitido com `Secure`, `HttpOnly` e `SameSite=Lax` (ou `SameSite=None; Secure` só quando `COOKIE_SAMESITE=none`).

#### Scenario: Login em produção
- **GIVEN** `NODE_ENV=production` e a configuração padrão
- **WHEN** o operador faz login
- **THEN** o cabeçalho `Set-Cookie` da sessão contém `Secure`, `HttpOnly` e `SameSite=Lax`

### Requirement: Cabeçalhos de segurança
Toda resposta de página e de `/api` SHALL trazer `Content-Security-Policy` (com `default-src 'self'`, `script-src` por nonce com `'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` e `frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` sem câmera, microfone, geolocalização e pagamento, e `Cross-Origin-Opener-Policy: same-origin`.

#### Scenario: Cabeçalhos numa página
- **WHEN** um usuário logado abre `/contratos`
- **THEN** a resposta traz todos esses cabeçalhos, e a página carrega sem violação de CSP no console do navegador

#### Scenario: Resposta 401 também protegida
- **WHEN** uma requisição sem sessão chega em `GET /api/contratos`
- **THEN** a resposta `401` traz `X-Content-Type-Options: nosniff` e `Content-Security-Policy`

### Requirement: Nonce de script por requisição
O nonce do `Content-Security-Policy` SHALL ser novo a cada requisição e SHALL ser aplicado aos scripts inline do Next.js e do seletor de tema.

#### Scenario: Nonce por requisição
- **WHEN** a mesma página é pedida duas vezes
- **THEN** o `nonce` do `Content-Security-Policy` é diferente nas duas respostas

### Requirement: Enquadramento compatível com a prévia
Sem `FRAME_ANCESTORS`, o sistema SHALL responder com `frame-ancestors 'self'` e `X-Frame-Options: SAMEORIGIN`. Com `FRAME_ANCESTORS` preenchido (origens `https://` separadas por espaço), o sistema SHALL responder com `frame-ancestors 'self' <origens>` e SHALL NOT enviar `X-Frame-Options`, para que a prévia em iframe dessas origens funcione.

#### Scenario: Produção sem prévia
- **GIVEN** `FRAME_ANCESTORS` vazio
- **WHEN** uma página do sistema é aberta dentro de um iframe de outra origem
- **THEN** a resposta traz `X-Frame-Options: SAMEORIGIN` e `frame-ancestors 'self'`, e o navegador bloqueia o enquadramento

#### Scenario: Prévia autorizada
- **GIVEN** `FRAME_ANCESTORS="https://previa.exemplo"` e `COOKIE_SAMESITE=none`
- **WHEN** a página é aberta num iframe de `https://previa.exemplo`
- **THEN** a resposta traz `frame-ancestors 'self' https://previa.exemplo`, não traz `X-Frame-Options`, e a página é exibida

### Requirement: Limite de upload no proxy
O proxy SHALL recusar com `413` qualquer requisição cujo corpo passe de `PROXY_MAX_BODY_MB`, antes de encaminhá-la ao app. `PROXY_MAX_BODY_MB` SHALL ser maior que `UPLOAD_MAX_MB`, e o limite de `savePdf()` (`UPLOAD_MAX_MB`) SHALL continuar valendo no app.

#### Scenario: Arquivo grande demais
- **GIVEN** `PROXY_MAX_BODY_MB=11`
- **WHEN** o operador envia um anexo de 20 MB
- **THEN** a resposta é `413` e nada é gravado no banco nem no disco

#### Scenario: Arquivo entre os limites
- **GIVEN** `UPLOAD_MAX_MB=10` e `PROXY_MAX_BODY_MB=11`
- **WHEN** o operador envia um PDF de 10,5 MB
- **THEN** o proxy encaminha e o app recusa com a mensagem de limite de `savePdf()`

### Requirement: Healthcheck
O sistema SHALL responder `GET /api/health` com `200 {"status":"ok"}` quando o banco responde a `SELECT 1` e a pasta de anexos é gravável, e com `503 {"status":"erro"}` caso contrário, sem nenhum outro dado na resposta. A rota SHALL ser acessível sem sessão só por `GET` e só pela rede interna: o proxy SHALL responder `404` a `/api/health`. O `healthcheck` do serviço `app` no compose SHALL usar essa rota, e o `proxy` SHALL esperar o `app` ficar `healthy`.

#### Scenario: Saudável
- **WHEN** o healthcheck do compose chama `http://127.0.0.1:3000/api/health`
- **THEN** a resposta é `200 {"status":"ok"}` e o serviço aparece `healthy`

#### Scenario: Banco indisponível
- **GIVEN** o arquivo do banco ilegível
- **WHEN** `/api/health` é chamado
- **THEN** a resposta é `503 {"status":"erro"}` e o motivo vai só para o log

#### Scenario: Chamado de fora
- **WHEN** alguém pede `https://<SITE_ADDRESS>/api/health`
- **THEN** o proxy responde `404`

#### Scenario: Outras rotas continuam protegidas
- **WHEN** uma requisição sem sessão chega em `POST /api/health` ou `GET /api/healthz`
- **THEN** a resposta é `401`

### Requirement: Logs estruturados sem segredos
O app SHALL escrever logs em stdout como uma linha JSON por evento, com `ts`, `level` e `evento`, para login, falha de login, logout, sessão inválida, acesso negado, upload recusado, erro interno, healthcheck com falha e avisos de configuração. Nenhuma linha de log do app ou do proxy SHALL conter senha, hash de senha, cookie, cabeçalho `Authorization`, token de sessão ou o valor de `AUTH_SECRET`. Os logs SHALL ser rotacionados (`json-file`, 10 MB × 5 por serviço).

#### Scenario: Falha de login
- **WHEN** alguém tenta entrar com usuário `maria` e senha errada
- **THEN** o log tem uma linha JSON com `"evento":"login.falha"` e `"username":"maria"` e nenhuma linha contém a senha digitada

#### Scenario: Erro interno
- **WHEN** uma rota de API lança uma exceção não tratada
- **THEN** a resposta é `500` sem detalhes internos e o log tem uma linha `"level":"error"`, `"evento":"erro.interno"` com rota e método

#### Scenario: Log de acesso do proxy
- **WHEN** um usuário logado navega pelo sistema
- **THEN** o log JSON do Caddy registra método, caminho, status e duração, e não contém os cabeçalhos `Cookie` nem `Set-Cookie`

### Requirement: Backup diário do banco
O serviço `backup` SHALL copiar o SQLite todo dia (padrão 02:00, `BACKUP_HORARIO`) com a API de backup online (`sqlite3 .backup`), SHALL verificar a cópia com `PRAGMA integrity_check`, SHALL gravar ao lado as contagens de linhas por tabela e a última migração aplicada, e SHALL comprimir e registrar o SHA-256.

#### Scenario: Backup com o app gravando
- **GIVEN** o app no ar recebendo gravações
- **WHEN** `backup.sh` roda
- **THEN** é criado `app-<AAAAMMDD-HHMMSS>.db.gz` com `.sha256` e `.json`, e o `integrity_check` da cópia é `ok`

#### Scenario: Cópia corrompida
- **WHEN** o `integrity_check` da cópia não devolve `ok`
- **THEN** o script termina com erro, loga `level: "error"` e nenhum backup anterior é apagado pela retenção

### Requirement: Retenção dos backups
A retenção SHALL manter os backups diários mais recentes (`BACKUP_RETENCAO_DIARIA`, padrão 14), o primeiro backup de cada um dos últimos meses (`BACKUP_RETENCAO_MENSAL`, padrão 6) e os backups com motivo (`pre-atualizacao-*`, `pre-migracao-*`) por 90 dias, e SHALL NOT apagar nada quando o backup do dia falhar.

#### Scenario: Retenção
- **GIVEN** 40 backups diários de 3 meses diferentes
- **WHEN** a retenção roda
- **THEN** ficam os 14 mais recentes mais o primeiro de cada mês, e os demais são apagados

### Requirement: Backup dos anexos
O serviço `backup` SHALL espelhar a pasta de anexos (`/app/data/uploads`) em `/backups/uploads` de forma incremental, sem apagar no destino arquivos removidos da origem, e SHALL gravar um manifesto SHA-256 diário dos anexos.

#### Scenario: Anexo novo
- **GIVEN** um PDF anexado hoje a um contrato
- **WHEN** o backup diário roda
- **THEN** o arquivo existe em `/backups/uploads` e consta do manifesto do dia com o mesmo SHA-256

### Requirement: Cópia do backup para fora do servidor
Depois de cada backup, o serviço `backup` SHALL enviar banco, anexos e manifestos para `BACKUP_REMOTE` por `rsync` sobre SSH com chave dedicada e `known_hosts` fixo, sem `--delete`. Sem `BACKUP_REMOTE`, ou com falha no envio, o script SHALL registrar uma linha de log `level: "error"` e terminar com código diferente de zero, mantendo o backup local.

#### Scenario: Envio normal
- **GIVEN** `BACKUP_REMOTE` configurado e acessível
- **WHEN** o backup diário termina
- **THEN** o arquivo `.db.gz` do dia e os anexos novos existem no destino

#### Scenario: Destino fora do ar
- **WHEN** o destino recusa a conexão
- **THEN** o backup local fica íntegro, o log registra `backup.copia_externa.falha` e a próxima execução envia o que faltou

### Requirement: Teste de restauração
O serviço `backup` SHALL testar toda semana (padrão domingo 03:30) a restauração do backup mais recente: SHA-256, `integrity_check`, contagens por tabela iguais às gravadas no backup, existência de todo anexo referenciado pelo banco no espelho de anexos com assinatura `%PDF-`, e manifesto dos anexos conferido. O resultado SHALL ser registrado em log (`restauracao.teste.ok` ou `restauracao.teste.falha` com o motivo).

#### Scenario: Backup íntegro
- **WHEN** `testar-restauracao.sh` roda sobre o backup mais recente
- **THEN** termina com código `0` e loga `restauracao.teste.ok` com as contagens por tabela

#### Scenario: Anexo faltando
- **GIVEN** um contrato cujo `anexo` não existe em `/backups/uploads`
- **WHEN** o teste de restauração roda
- **THEN** termina com código diferente de zero e loga `restauracao.teste.falha` citando a tabela, o id e o arquivo

### Requirement: Restauração
O procedimento `restaurar.sh <arquivo>` SHALL recusar rodar com o app no ar, SHALL conferir SHA-256 e `integrity_check` do backup, SHALL preservar o banco atual com o sufixo `.antes-restauracao-<data>` e SHALL repor banco e anexos de modo que o app volte `healthy` com os dados do backup.

#### Scenario: Restaurar um backup
- **GIVEN** o app parado e um backup válido de ontem
- **WHEN** o operador roda `restaurar.sh` com esse arquivo e inicia o app
- **THEN** o app fica `healthy`, as contagens por tabela são as do `.json` do backup, e o banco anterior está preservado com o sufixo

#### Scenario: App no ar
- **WHEN** `restaurar.sh` roda com o app respondendo
- **THEN** o script recusa sem alterar nada

### Requirement: Atualização com migrations
O procedimento `scripts/ops/atualizar.sh <versao>` SHALL, nesta ordem: fazer um backup com motivo `pre-atualizacao-<versao>`, construir a imagem `detran-contratos:<versao>`, subir o app (que aplica `prisma migrate deploy` no start), esperar `healthy` por até 180 s e rodar o smoke pelo proxy (`/login` `200`, `/api/contratos` sem sessão `401`, cabeçalhos HSTS e CSP presentes). Se alguma etapa falhar, SHALL parar e imprimir o comando de rollback.

#### Scenario: Atualização com migração nova
- **GIVEN** a versão `v1.1.0` traz uma migração Prisma nova
- **WHEN** o operador roda `atualizar.sh v1.1.0`
- **THEN** existe o backup `pre-atualizacao-v1.1.0`, a migração aparece em `_prisma_migrations`, o app está `healthy` e o smoke passa

#### Scenario: Versão que não fica saudável
- **WHEN** o app novo não fica `healthy` em 180 s
- **THEN** o script termina com erro e mostra o comando `scripts/ops/rollback.sh`

### Requirement: Rollback
O procedimento `scripts/ops/rollback.sh` SHALL voltar à versão anterior registrada pela última atualização, restaurando o backup `pre-atualizacao-*` correspondente antes de subir a imagem anterior, e SHALL esperar o app ficar `healthy`.

#### Scenario: Voltar uma versão
- **GIVEN** uma atualização de `v1.0.0` para `v1.1.0` com migração nova
- **WHEN** o operador roda `rollback.sh`
- **THEN** o app roda a imagem `v1.0.0`, `_prisma_migrations` não tem a migração da `v1.1.0`, e o app está `healthy`

### Requirement: Imagem sem privilégio
O container `app` SHALL rodar como usuário sem privilégio (`node`, uid 1000) e SHALL falhar no start com mensagem clara se `/app/data` não for gravável por esse usuário.

#### Scenario: Usuário do processo
- **WHEN** o operador roda `docker compose exec app id -u`
- **THEN** a saída é `1000`

### Requirement: Integração contínua
O repositório SHALL ter um workflow do GitHub Actions que, em todo push e pull request, roda lint, verificação de tipos, testes, build do Next.js, `openspec validate --all --strict`, build das imagens `app` e `backup`, `docker compose config` e um ciclo de backup e teste de restauração na stack subida no job; qualquer falha SHALL marcar a execução como falha. O workflow SHALL NOT usar segredos do repositório nem publicar imagem.

#### Scenario: Pull request com teste quebrado
- **WHEN** um pull request faz um teste do Vitest falhar
- **THEN** o job `verificar` falha e o job `imagem` não roda

#### Scenario: Pull request válido
- **WHEN** um pull request passa em todas as etapas
- **THEN** os dois jobs terminam com sucesso e o teste de restauração do job `imagem` registra `restauracao.teste.ok`

### Requirement: Runbook de operação
O repositório SHALL ter `docs/operacao.md` com as seções: requisitos do servidor, instalação, primeiro acesso, carga do legado, variáveis de ambiente, certificados, backup, restauração, teste de restauração, atualização, rollback, rotação de segredos, logs e solução de problemas. Todo comando do runbook SHALL ter sido executado na verificação desta change.

#### Scenario: Instalação do zero
- **GIVEN** um servidor limpo com Docker e o runbook
- **WHEN** um operador segue só a seção de instalação
- **THEN** o sistema responde em HTTPS e o primeiro acesso funciona sem consultar outro documento
