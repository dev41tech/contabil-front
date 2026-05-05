# ── Build stage: compila o React/Vite ────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copia manifests e instala deps (layer cacheada se não mudar package.json)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copia código e compila
COPY . .

# VITE_API_BASE_URL é relativo (/api/v1) — não precisa de env var,
# o nginx vai proxy /api para o backend.
RUN npm run build

# ── Runtime stage: nginx serve os arquivos estáticos ─────────────────────────
FROM nginx:1.27-alpine

# Remove config padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia nossa config com o proxy para o backend
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copia o build do Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Script de entrypoint que substitui BACKEND_HOST pela variável de ambiente
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3013

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:3013/ | grep -q "<!doctype html>" || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
