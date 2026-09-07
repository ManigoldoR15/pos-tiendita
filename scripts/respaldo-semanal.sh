#!/usr/bin/env bash
# Respaldo semanal de la base de produccion.
# Genera respaldos/postiendita-AAAA-MM-DD.tar.gz y conserva los ultimos 8.
# Si el proyecto de Supabase esta dormido, falla ruidoso y NO toca los respaldos viejos.
set -uo pipefail

PROY="/home/efrain/proyectos/pos-mx/pos-tiendita"
DESTINO="/home/efrain/proyectos/pos-mx/respaldos"
CONSERVAR=8
REGISTRO="$DESTINO/registro.log"

mkdir -p "$DESTINO"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$REGISTRO"; }

if [ ! -f "$PROY/.env.local" ]; then log "ERROR: no existe $PROY/.env.local"; exit 1; fi
set -a; . "$PROY/.env.local"; set +a
: "${NEXT_PUBLIC_SUPABASE_URL:?falta NEXT_PUBLIC_SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?falta SUPABASE_SERVICE_ROLE_KEY}"

log "--- inicia respaldo ---"

# El proyecto free se pausa: si duerme, el DNS ni resuelve. Reintenta antes de rendirse.
despierto=0
for intento in 1 2 3; do
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" || echo 000)
  if [ "$codigo" != "000" ]; then despierto=1; break; fi
  log "intento $intento: el proyecto no responde (posible pausa por inactividad)"
  sleep 20
done
if [ "$despierto" -eq 0 ]; then
  log "ERROR: Supabase inalcanzable. Despiertalo en el dashboard y corre este script a mano."
  log "--- respaldo NO realizado ---"
  exit 1
fi

FECHA=$(date +%Y-%m-%d)
TRABAJO=$(mktemp -d "$DESTINO/.parcial-$FECHA.XXXX")
trap 'rm -rf "$TRABAJO"' EXIT

if ! SB_URL="$NEXT_PUBLIC_SUPABASE_URL" SB_KEY="$SUPABASE_SERVICE_ROLE_KEY" OUT_DIR="$TRABAJO" \
     node "$PROY/scripts/respaldo-supabase.mjs" >>"$REGISTRO" 2>&1; then
  log "ERROR: el volcado fallo (ver detalle arriba). Los respaldos anteriores quedan intactos."
  exit 1
fi

cp -r "$PROY/supabase" "$TRABAJO/esquema"
git -C "$PROY" rev-parse HEAD > "$TRABAJO/git-commit.txt" 2>/dev/null
git -C "$PROY" log -1 --format='%H %ad %s' --date=iso >> "$TRABAJO/git-commit.txt" 2>/dev/null
cp "$DESTINO/LEEME-plantilla.md" "$TRABAJO/LEEME.md" 2>/dev/null || true

SALIDA="$DESTINO/postiendita-$FECHA"
rm -rf "$SALIDA"
mv "$TRABAJO" "$SALIDA"
trap - EXIT

tar czf "$DESTINO/postiendita-$FECHA.tar.gz" -C "$DESTINO" "postiendita-$FECHA"
FILAS=$(node -e "console.log(require('$SALIDA/resumen.json').total_filas)" 2>/dev/null || echo '?')
rm -rf "$SALIDA"
PESO=$(du -h "$DESTINO/postiendita-$FECHA.tar.gz" | cut -f1)
log "OK: postiendita-$FECHA.tar.gz ($PESO, $FILAS filas)"

# Rotacion: deja los CONSERVAR mas recientes
ls -1t "$DESTINO"/postiendita-*.tar.gz 2>/dev/null | tail -n +$((CONSERVAR + 1)) | while read -r viejo; do
  log "rota: elimina $(basename "$viejo")"
  rm -f "$viejo"
done

log "--- termina respaldo ---"
