#!/bin/sh
# 026-producao task 6.4, cenário "Cópia corrompida": o integrity_check da cópia não devolve ok →
# backup.sh sai ≠ 0, loga level error e nenhum backup anterior some (a retenção não roda).
# Roda dentro da imagem do backup: docker compose run --rm backup /usr/local/share/backup-testes/corrompido.test.sh
set -eu
RAIZ="$(mktemp -d)"
trap 'rm -rf "$RAIZ"' EXIT
export DADOS_DIR="$RAIZ/dados" BACKUPS_DIR="$RAIZ/backups" BACKUP_REMOTE=""
mkdir -p "$DADOS_DIR/uploads" "$BACKUPS_DIR/db"
sqlite3 "$DADOS_DIR/app.db" "CREATE TABLE t(x); INSERT INTO t VALUES (1);"
# 20 backups diários antigos: com um backup íntegro, a retenção (14) apagaria 6.
i=0
while [ "$i" -lt 20 ]; do
  n="app-$(date -d "-$((i + 1)) days" +%Y%m%d)-020000"
  for e in db.gz db.gz.sha256 json; do : > "$BACKUPS_DIR/db/$n.$e"; done
  i=$((i + 1))
done
ANTES="$(ls -1 "$BACKUPS_DIR/db" | sort)"

# Stub do sqlite3: repassa tudo ao real, menos o PRAGMA integrity_check, que devolve erro.
mkdir -p "$RAIZ/stub"
cat > "$RAIZ/stub/sqlite3" <<'STUB'
#!/bin/sh
for a in "$@"; do case "$a" in *integrity_check*) echo "*** in database main *** Page 2: btreeInitPage() returns error code 11"; exit 0 ;; esac; done
exec /usr/bin/sqlite3 "$@"
STUB
chmod +x "$RAIZ/stub/sqlite3"

set +e
PATH="$RAIZ/stub:$PATH" backup.sh > "$RAIZ/saida.log" 2>&1
CODIGO=$?
set -e
cat "$RAIZ/saida.log"
[ "$CODIGO" -ne 0 ] || { echo "FALHOU: backup.sh saiu 0 com cópia corrompida"; exit 1; }
grep -q '"level":"error","evento":"backup.integridade.falha"' "$RAIZ/saida.log" || { echo "FALHOU: sem log de erro"; exit 1; }
[ "$(ls -1 "$BACKUPS_DIR/db" | sort)" = "$ANTES" ] || { echo "FALHOU: algum backup anterior sumiu ou um novo apareceu"; exit 1; }
[ -z "$(ls -A "$BACKUPS_DIR/tmp")" ] || { echo "FALHOU: sobrou cópia temporária"; exit 1; }
echo "ok cópia corrompida: código $CODIGO, log de erro, $(echo "$ANTES" | wc -l) arquivos anteriores intactos"
