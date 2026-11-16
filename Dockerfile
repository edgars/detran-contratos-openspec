# App Next.js (frontend + API) com Prisma e SQLite — 001-project-foundation.
# A change 018-deployment refina imagens e orquestração.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# 025-migracao-legado: carga do legado (`docker compose --profile migracao run --rm migrar …`).
# Fica ANTES do estágio `run`, que continua o último (o serviço `app` não declara target). Parte de `deps`
# (node_modules com devDependencies: tsx e a CLI do Prisma) mais o código; não precisa do `next build`.
FROM deps AS migrar
WORKDIR /app
COPY . .
RUN npx prisma generate
# Aplica as migrações versionadas (o banco pode ser o do volume ou outro, por DATABASE_URL) e roda a carga.
ENTRYPOINT ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma >&2 && exec node_modules/.bin/tsx scripts/migrar.ts \"$@\"", "migrar"]

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
# CLI do Prisma só para `migrate deploy` no start (mesma major do package.json).
RUN npm i -g prisma@6 --no-audit --no-fund
COPY docker/entrypoint.sh ./entrypoint.sh
RUN mkdir -p /app/data && chmod +x ./entrypoint.sh
EXPOSE 3000
# Aplica as migrações versionadas no start e sobe o servidor.
ENTRYPOINT ["./entrypoint.sh"]
