#!/bin/sh
# 026-producao › Backup diário do banco, Backup dos anexos, Retenção e Cópia para fora do servidor.
# Uso: backup.sh [--motivo <texto>]
# Saída: 0 = backup local e cópia externa ok; 1 = backup falhou (nada substituído, retenção não roda);
#        3 = backup local ok, mas sem cópia externa (BACKUP_REMOTE vazio ou envio falhou).
set -u
. /usr/local/bin/lib.sh

MOTIVO=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --motivo) MOTIVO="${2:-}"; shift 2 ;;
    *) logj error backup.uso "\"msg\":\"argumento desconhecido\""; exit 1 ;;
  esac
done
# Só letras minúsculas, dígitos, ponto, hífen e sublinhado no nome do arquivo.
MOTIVO="$(printf '%s' "$MOTIVO" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9._-' '-' | sed 's/^-*//;s/-*$//')"

TS="$(date +%Y%m%d-%H%M%S)"
NOME="app-$TS${MOTIVO:+-$MOTIVO}"
TMP="$BACKUPS_DIR/tmp"
mkdir -p "$TMP" "$BACKUPS_DIR/db" "$BACKUPS_DIR/uploads" "$BACKUPS_DIR/manifestos"

falha() { # falha <evento> <msg>
  logj error "$1" "\"arquivo\":$(json_str "$NOME"),\"msg\":$(json_str "$2")"
  rm -f "$TMP/$NOME.db" "$TMP/$NOME.json"
  exit 1
}

# Grava contagens por tabela e a última migração de um banco SQLite num .json.
contagens_json() { # contagens_json <banco> <arquivo> <motivo>
  _tabelas="$(sqlite3 "$1" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")" || return 1
  _obj="{}"
  for t in $_tabelas; do
    _n="$(sqlite3 "$1" "SELECT count(*) FROM \"$t\"")" || return 1
    _obj="$(printf '%s' "$_obj" | jq -c --arg t "$t" --argjson n "$_n" '. + {($t): $n}')"
  done
  _mig="$(sqlite3 "$1" "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC, migration_name DESC LIMIT 1" 2>/dev/null || true)"
  jq -n --arg arquivo "$(basename "$2" .json)" --arg criado "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg motivo "$3" \
    --arg migracao "$_mig" --argjson tabelas "$_obj" \
    '{arquivo: $arquivo, criado: $criado, motivo: $motivo, ultimaMigracao: $migracao, integrity_check: "ok", tabelas: $tabelas}' > "$2"
}

# Comprime e registra o SHA-256 de um banco já conferido; move o .json para db/.
guardar() { # guardar <banco> <nome>
  gzip -9 -c "$1" > "$BACKUPS_DIR/db/$2.db.gz.parcial" || return 1
  mv "$BACKUPS_DIR/db/$2.db.gz.parcial" "$BACKUPS_DIR/db/$2.db.gz"
  (cd "$BACKUPS_DIR/db" && sha256sum "$2.db.gz" > "$2.db.gz.sha256")
}

[ -f "$DB" ] || falha backup.falha "banco não encontrado em $DB"

# 1. API de backup online do SQLite: consistente com o app gravando (não copia o arquivo cru).
sqlite3 "$DB" ".timeout 30000" ".backup '$TMP/$NOME.db'" || falha backup.falha "sqlite3 .backup falhou"

# 2. A cópia tem de passar no integrity_check; senão nada é substituído e a retenção não roda.
INTEGRIDADE="$(sqlite3 "$TMP/$NOME.db" "PRAGMA integrity_check" 2>&1)"
[ "$INTEGRIDADE" = "ok" ] || falha backup.integridade.falha "integrity_check da cópia: $(printf '%s' "$INTEGRIDADE" | head -n 3)"

# 3. Contagens por tabela e última migração aplicada.
contagens_json "$TMP/$NOME.db" "$TMP/$NOME.json" "$MOTIVO" || falha backup.falha "contagem das tabelas falhou"

# 4. gzip + SHA-256.
guardar "$TMP/$NOME.db" "$NOME" || falha backup.falha "compressão falhou"
mv "$TMP/$NOME.json" "$BACKUPS_DIR/db/$NOME.json"
rm -f "$TMP/$NOME.db"
logj info backup.banco.ok "\"arquivo\":\"$NOME.db.gz\",\"bytes\":$(stat -c %s "$BACKUPS_DIR/db/$NOME.db.gz"),\"tabelas\":$(jq -c .tabelas "$BACKUPS_DIR/db/$NOME.json")"

# 4b. Backups pre-migracao-*.db da carga do legado (025) no volume dados: conferidos, comprimidos e movidos.
if [ -d "$DADOS_DIR/backups" ]; then
  for f in "$DADOS_DIR"/backups/pre-migracao-*.db; do
    [ -f "$f" ] || continue
    n="$(basename "$f" .db)"
    if [ "$(sqlite3 "$f" "PRAGMA integrity_check" 2>&1)" != "ok" ]; then
      logj error backup.pre_migracao.falha "\"arquivo\":$(json_str "$n"),\"msg\":\"integrity_check falhou; mantido no volume dados\""
      continue
    fi
    if contagens_json "$f" "$BACKUPS_DIR/db/$n.json" "pre-migracao" && guardar "$f" "$n"; then
      rm -f "$f"
      logj info backup.pre_migracao.ok "\"arquivo\":\"$n.db.gz\""
    fi
  done
fi

# 5. Anexos: espelho incremental SEM --delete (arquivo apagado no app continua no backup) e manifesto do dia.
if [ -d "$DADOS_DIR/uploads" ]; then
  rsync -a "$DADOS_DIR/uploads/" "$BACKUPS_DIR/uploads/" || falha backup.anexos.falha "rsync dos anexos falhou"
fi
MANIFESTO="$BACKUPS_DIR/manifestos/uploads-$(date +%Y%m%d).sha256"
(cd "$BACKUPS_DIR/uploads" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum) > "$MANIFESTO.parcial" \
  && mv "$MANIFESTO.parcial" "$MANIFESTO" || falha backup.anexos.falha "manifesto dos anexos falhou"
logj info backup.anexos.ok "\"arquivos\":$(wc -l < "$MANIFESTO"),\"manifesto\":\"$(basename "$MANIFESTO")\""

# 6. Retenção (só depois de um backup íntegro).
retencao.sh || logj error backup.retencao.falha "\"msg\":\"retencao.sh terminou com erro\""

# 7. Cópia para fora do servidor, sem --delete (um servidor comprometido não apaga o histórico do destino).
if [ -z "${BACKUP_REMOTE:-}" ]; then
  logj error backup.sem_copia_externa "\"msg\":\"BACKUP_REMOTE vazio: backup só local\",\"arquivo\":\"$NOME.db.gz\""
  exit 3
fi
SSH="ssh -i $SEGREDOS_DIR/id_ed25519 -o UserKnownHostsFile=$SEGREDOS_DIR/known_hosts -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=15${BACKUP_SSH_PORTA:+ -p $BACKUP_SSH_PORTA}"
if rsync -a -e "$SSH" "$BACKUPS_DIR/db" "$BACKUPS_DIR/uploads" "$BACKUPS_DIR/manifestos" "$BACKUP_REMOTE/" 2> "$TMP/rsync.err"; then
  logj info backup.copia_externa.ok "\"destino\":$(json_str "$BACKUP_REMOTE"),\"arquivo\":\"$NOME.db.gz\""
  rm -f "$TMP/rsync.err"
  exit 0
fi
logj error backup.copia_externa.falha "\"destino\":$(json_str "$BACKUP_REMOTE"),\"msg\":$(json_str "$(tail -n 3 "$TMP/rsync.err")")"
rm -f "$TMP/rsync.err"
exit 3
