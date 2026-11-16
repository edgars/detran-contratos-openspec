#!/bin/sh
# Chave pública do backup (montada em /chave.pub) autorizada para o usuário `backup`; só chave, sem senha.
set -e
ssh-keygen -A >/dev/null
install -d -m 700 -o backup -g backup /home/backup/.ssh
install -m 600 -o backup -g backup /chave.pub /home/backup/.ssh/authorized_keys
exec /usr/sbin/sshd -D -e -o PasswordAuthentication=no -o PermitRootLogin=no
