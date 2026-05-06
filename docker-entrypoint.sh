#!/bin/sh
set -e

# BACKEND_HOST = hostname ou IP do serviço backend
# Padrão: "backend" (nome do serviço no EasyPanel/Docker network)
BACKEND_HOST="${BACKEND_HOST:-backend}"
BACKEND_URL="http://${BACKEND_HOST}:3012"

echo "Configurando proxy nginx → ${BACKEND_URL}"

# Substitui o placeholder pela URL completa do backend
sed -i "s|BACKEND_UPSTREAM|${BACKEND_URL}|g" /etc/nginx/conf.d/app.conf

# Valida a config antes de iniciar
nginx -t

# Inicia nginx em foreground
exec nginx -g "daemon off;"
