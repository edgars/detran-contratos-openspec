# 026-producao task 6.5: servidor SSH de TESTE que faz o papel do destino externo do backup (BACKUP_REMOTE).
FROM alpine:3.20
RUN apk add --no-cache openssh-server rsync \
 && adduser -D -s /bin/sh backup && passwd -u backup >/dev/null 2>&1 || true \
 && mkdir -p /destino && chown backup:backup /destino
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 22
ENTRYPOINT ["/entrypoint.sh"]
