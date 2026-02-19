#!/usr/bin/env bash
# =============================================================
#  generate-ssl.sh  –  Generador de certificado SSL autofirmado
#  Lee la configuración desde .env.ssl
#
#  Compatibilidad: Git Bash (Windows), WSL, Linux, macOS
# =============================================================

set -euo pipefail

# ── 1. Cargar variables del entorno SSL ──────────────────────
ENV_FILE="$(dirname "$0")/.env.ssl"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌  No se encontró el archivo: $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
set +a

# ── Git Bash en Windows convierte strings como /C=CO/ST=...
#    como si fueran rutas de archivo.  Estas dos variables lo desactivan.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

# ── 2. Detectar IP de la interfaz de salida (si SSL_IP=auto) ─
detect_outbound_ip() {
  local probe="${SSL_PROBE_HOST:-8.8.8.8}"
  local detected=""

  # Método 1: ip route (Linux / WSL / Git-Bash con iproute2)
  if command -v ip &>/dev/null; then
    detected=$(ip route get "$probe" 2>/dev/null \
      | grep -oP 'src \K[\d.]+' | head -1)
  fi

  # Método 2: route + ipconfig (Git Bash nativo en Windows)
  if [ -z "$detected" ] && command -v ipconfig &>/dev/null; then
    # Obtiene el gateway de la ruta por defecto y luego la IP
    # de la interfaz que lo usa
    local gw
    gw=$(route print 0.0.0.0 2>/dev/null \
      | grep -E '^\s+0\.0\.0\.0\s+0\.0\.0\.0' \
      | awk '{print $3}' | head -1)

    if [ -n "$gw" ]; then
      # Busca en ipconfig la IP del bloque que contenga ese gateway
      detected=$(ipconfig 2>/dev/null \
        | awk -v gw="$gw" '
          /IPv4/ { ip = $NF }
          $0 ~ gw { print ip; exit }
        ')
    fi
  fi

  # Método 3: fallback con netstat (macOS y BSDs)
  if [ -z "$detected" ] && command -v netstat &>/dev/null; then
    local iface
    iface=$(netstat -rn 2>/dev/null \
      | awk '/^0\.0\.0\.0|^default/ {print $NF; exit}')
    if [ -n "$iface" ]; then
      detected=$(ifconfig "$iface" 2>/dev/null \
        | grep 'inet ' | awk '{print $2}' | head -1)
    fi
  fi

  echo "$detected"
}

# ── 3. Resolver la IP final a usar ───────────────────────────
RESOLVED_IP="$SSL_IP"

if [ "$SSL_IP" = "auto" ]; then
  echo "🔍  Detectando interfaz de salida a internet..."
  RESOLVED_IP=$(detect_outbound_ip)

  if [ -z "$RESOLVED_IP" ]; then
    echo "❌  No se pudo detectar la IP de salida automáticamente."
    echo "    Edita SSL_IP en .env.ssl y pon la dirección manualmente."
    exit 1
  fi
fi

echo "══════════════════════════════════════════════"
echo "  🔐  Generador de Certificado SSL – LTESISTEM"
echo "══════════════════════════════════════════════"
echo "  Modo       : ${SSL_IP}"
echo "  IP usada   : ${RESOLVED_IP}"
echo "  Hostname   : ${SSL_HOSTNAME}"
echo "  Vigencia   : ${SSL_DAYS} días"
echo "  Salida     : ${SSL_OUTPUT_DIR}"
echo "══════════════════════════════════════════════"
echo ""

# ── 4. Crear directorio de salida ────────────────────────────
mkdir -p "$SSL_OUTPUT_DIR"

# ── 5. Rutas de los archivos generados ───────────────────────
CA_KEY="$SSL_OUTPUT_DIR/${SSL_CERT_NAME}-ca.key"
CA_CERT="$SSL_OUTPUT_DIR/${SSL_CERT_NAME}-ca.crt"
SERVER_KEY="$SSL_OUTPUT_DIR/${SSL_CERT_NAME}.key"
SERVER_CSR="$SSL_OUTPUT_DIR/${SSL_CERT_NAME}.csr"
SERVER_CERT="$SSL_OUTPUT_DIR/${SSL_CERT_NAME}.crt"
EXT_FILE="$SSL_OUTPUT_DIR/${SSL_CERT_NAME}.ext"

# ── 6. Generar CA (Autoridad Certificadora local) ─────────────
echo "▶  Generando CA local..."
openssl genrsa -out "$CA_KEY" "$SSL_KEY_SIZE" 2>/dev/null
openssl req -x509 -new -nodes \
  -key "$CA_KEY" \
  -sha256 \
  -days "$SSL_DAYS" \
  -out "$CA_CERT" \
  -subj "/C=${SSL_COUNTRY}/ST=${SSL_STATE}/L=${SSL_CITY}/O=${SSL_ORG} CA/CN=${SSL_ORG} Root CA"
echo "   ✔  CA generada : $CA_CERT"

# ── 7. Generar clave privada del servidor ─────────────────────
echo "▶  Generando clave privada del servidor..."
openssl genrsa -out "$SERVER_KEY" "$SSL_KEY_SIZE" 2>/dev/null
echo "   ✔  Clave        : $SERVER_KEY"

# ── 8. Generar CSR ────────────────────────────────────────────
echo "▶  Generando CSR..."
openssl req -new \
  -key "$SERVER_KEY" \
  -out "$SERVER_CSR" \
  -subj "/C=${SSL_COUNTRY}/ST=${SSL_STATE}/L=${SSL_CITY}/O=${SSL_ORG}/CN=${RESOLVED_IP}"
echo "   ✔  CSR          : $SERVER_CSR"

# ── 9. Extensiones SAN con la IP detectada ────────────────────
cat > "$EXT_FILE" <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
IP.1 = ${RESOLVED_IP}
DNS.1 = ${SSL_HOSTNAME}
DNS.2 = localhost
EOF

# ── 10. Firmar el certificado ─────────────────────────────────
echo "▶  Firmando certificado con la CA local..."
openssl x509 -req \
  -in "$SERVER_CSR" \
  -CA "$CA_CERT" \
  -CAkey "$CA_KEY" \
  -CAcreateserial \
  -out "$SERVER_CERT" \
  -days "$SSL_DAYS" \
  -sha256 \
  -extfile "$EXT_FILE" 2>/dev/null
echo "   ✔  Certificado  : $SERVER_CERT"

# ── 11. Resumen ───────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
echo "  ✅  Certificado generado exitosamente"
echo "══════════════════════════════════════════════"
echo "  IP en el cert : $RESOLVED_IP"
echo "  CA cert       : $CA_CERT"
echo "  Certificado   : $SERVER_CERT"
echo "  Clave privada : $SERVER_KEY"
echo ""
echo "  👉  Pasos siguientes:"
echo "  1. Instala '$CA_CERT' como CA raíz de confianza en tus"
echo "     dispositivos/navegadores."
echo "  2. Configura tu servidor (Nginx / Express) con:"
echo "       ssl_certificate     $SERVER_CERT"
echo "       ssl_certificate_key $SERVER_KEY"
echo "══════════════════════════════════════════════"
