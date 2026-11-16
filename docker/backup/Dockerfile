# 026-producao: serviço `backup` (sqlite3 .backup, integrity_check, gzip, espelho dos anexos com manifesto
# SHA-256, retenção, cópia externa por rsync sobre SSH, teste de restauração). crond do BusyBox em primeiro plano.
FROM alpine:3.20
RUN apk add --no-cache sqlite rsync openssh-client tzdata coreutils jq \
 # O volume `dados` pertence ao uid 1000 (usuário do app): se este container o montar primeiro, o volume novo
 # nasce com o dono deste ponto de montagem.
 && mkdir -p /data/uploads /backups && chown 1000:1000 /data /data/uploads
ENV TZ=America/Sao_Paulo
COPY lib.sh backup.sh retencao.sh testar-restauracao.sh restaurar.sh entrypoint.sh /usr/local/bin/
COPY crontab /etc/backup/crontab
COPY testes /usr/local/share/backup-testes
RUN chmod +x /usr/local/bin/*.sh /usr/local/share/backup-testes/*.sh
WORKDIR /backups
ENTRYPOINT ["entrypoint.sh"]
