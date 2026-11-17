#!/bin/sh
# 026-producao › Teste de restauração (semanal no cron e sob demanda; também no CI).
# Uso: testar-restauracao.sh [arquivo.db.gz]   (padrão: o backup mais recente de /backups/db)
# Confere SHA-256, integrity_check, contagens por tabela iguais às do .json, todo anexo referenciado pelo
# banco presente no espelho com assinatura %PDF-, e o manifesto SHA-256 dos anexos. Saída 0 = ok.
set -u
. /usr/local/bin/lib.sh

DIR="$BACKUPS_DIR/db"
ARQ="${1:-}"
if [ -z "$ARQ" ]; then ARQ="$(ls -1t "$DIR"/*.db.gz 2>/dev/null | head -n 1)"; fi
case "$ARQ" in /*) ;; *) [ -n "$ARQ" ] && ARQ="$DIR/$ARQ" ;; esac
NOME="$(basename "${ARQ:-nenhum}" .db.gz)"
TRAB="$(mktemp -d)"
trap 'rm -rf "$TRAB"' EXIT

falha() {
  logj error restauracao.teste.falha "\"arquivo\":$(json_str "$NOME.db.gz"),\"motivo\":$(json_str "$1")"
  exit 1
}

[ -n "$ARQ" ] && [ -f "$ARQ" ] || falha "nenhum backup encontrado em $DIR"
[ -f "$ARQ.sha256" ] || falha "sem $NOME.db.gz.sha256"
(cd "$(dirname "$ARQ")" && sha256sum -c --status "$NOME.db.gz.sha256") || falha "SHA-256 não confere"

gunzip -c "$ARQ" > "$TRAB/app.db" || falha "descompactação falhou"
[ "$(sqlite3 "$TRAB/app.db" "PRAGMA integrity_check" 2>&1)" = "ok" ] || falha "integrity_check não devolveu ok"

# Contagens: iguais às gravadas no .json do backup.
JSON="$DIR/$NOME.json"
[ -f "$JSON" ] || falha "sem $NOME.json"
CONTAGENS="{}"
for t in $(sqlite3 "$TRAB/app.db" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"); do
  n="$(sqlite3 "$TRAB/app.db" "SELECT count(*) FROM \"$t\"")"
  CONTAGENS="$(printf '%s' "$CONTAGENS" | jq -c --arg t "$t" --argjson n "$n" '. + {($t): $n}')"
done
DIFERENCA="$(jq -c --argjson atual "$CONTAGENS" '.tabelas as $g | [($g + $atual | keys[]) | select($g[.] != $atual[.]) | {tabela: ., backup: $g[.], restaurado: $atual[.]}]' "$JSON")"
[ "$DIFERENCA" = "[]" ] || falha "contagens diferentes do .json: $DIFERENCA"

# Anexos referenciados pelo banco: existem no espelho e começam com %PDF-.
for alvo in contratos.anexo contratos.projetoBasico anexos_fiscais.anexo anexos_publicacao.anexo penalidades.arquivo pagamento_arquivos.arquivo; do
  tabela="${alvo%.*}"; coluna="${alvo#*.}"
  sqlite3 -separator '|' "$TRAB/app.db" "SELECT id, \"$coluna\" FROM \"$tabela\" WHERE \"$coluna\" IS NOT NULL AND \"$coluna\" <> ''" 2>/dev/null > "$TRAB/refs" || continue
  while IFS='|' read -r id arquivo; do
    f="$BACKUPS_DIR/uploads/$arquivo"
    [ -f "$f" ] || falha "anexo ausente no espelho: tabela=$tabela id=$id arquivo=$arquivo"
    [ "$(head -c 5 "$f")" = "%PDF-" ] || falha "anexo sem assinatura %PDF-: tabela=$tabela id=$id arquivo=$arquivo"
  done < "$TRAB/refs"
done

# Manifesto dos anexos mais recente.
MANIFESTO="$(ls -1 "$BACKUPS_DIR"/manifestos/uploads-*.sha256 2>/dev/null | LC_ALL=C sort | tail -n 1)"
# Manifesto vazio (instalação nova, sem anexos) é válido: o sha256sum recusaria um arquivo sem linhas.
if [ -n "$MANIFESTO" ] && [ -s "$MANIFESTO" ]; then
  (cd "$BACKUPS_DIR/uploads" && sha256sum -c --quiet "$MANIFESTO" > "$TRAB/manifesto.err" 2>&1) \
    || falha "manifesto $(basename "$MANIFESTO") não confere: $(head -n 3 "$TRAB/manifesto.err" | tr '\n' ' ')"
fi

logj info restauracao.teste.ok "\"arquivo\":\"$NOME.db.gz\",\"manifesto\":$(json_str "$(basename "${MANIFESTO:-}")"),\"tabelas\":$CONTAGENS"
