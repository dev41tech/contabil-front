#!/bin/sh
set -e

# Substitui BACKEND_HOST no nginx.conf pelo valor da variável de ambiente.
# Padrão: "backend" (nome do serviço no EasyPanel/Docker network)
BACKEND_HOST="${BACKEND_HOST:-backend}"

echo "Configurando proxy nginx → http://${BACKEND_HOST}:8000"
sed -i "s|BACKEND_HOST|${BACKEND_HOST}|g" /etc/nginx/conf.d/app.conf

# Inicia nginx em foreground
exec nginx -g "daemon off;"
