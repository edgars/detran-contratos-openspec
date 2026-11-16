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
# 026-producao: validação do ambiente (src/lib/env-cli.ts) empacotada num arquivo só, rodada pelo entrypoint
# antes do `prisma migrate deploy` (esbuild vem com o tsx/vitest do package-lock).
RUN node_modules/.bin/esbuild src/lib/env-cli.ts --bundle --platform=node --target=node22 --outfile=check-env.js --log-level=warning

# 025-migracao-legado: carga do legado (`docker compose --profile migracao run --rm migrar …`).
# Fica ANTES do estágio `run`, que continua o último (o serviço `app` não declara target). Parte de `deps`
# (node_modules com devDependencies: tsx e a CLI do Prisma) mais o código; não precisa do `next build`.
FROM deps AS migrar
WORKDIR /app
COPY . .
RUN npx prisma generate
# 026-producao: a carga grava no volume `dados`, que pertence ao uid 1000 (o mesmo usuário do app).
USER node
# Aplica as migrações versionadas (o banco pode ser o do volume ou outro, por DATABASE_URL) e roda a carga.
ENTRYPOINT ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma >&2 && exec node_modules/.bin/tsx scripts/migrar.ts \"$@\"", "migrar"]

FROM node:22-alpine AS run
# 026-producao: versão da imagem (tag git); o compose passa APP_VERSION.
ARG APP_VERSION=dev
LABEL org.opencontainers.image.version=$APP_VERSION org.opencontainers.image.title="detran-contratos"
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# CLI do Prisma só para `migrate deploy` no start (mesma major do package.json); os engines baixam aqui, como root.
RUN npm i -g prisma@6 --no-audit --no-fund && prisma --version > /dev/null
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/check-env.js ./check-env.js
COPY --chown=node:node docker/entrypoint.sh ./entrypoint.sh
# Os COPY acima já entregam /app ao node; aqui só as pastas (chown -R duplicaria ~100 MB numa camada nova).
RUN mkdir -p /app/data/uploads && chmod +x ./entrypoint.sh && chown node:node /app /app/data /app/data/uploads
# 026-producao: sem privilégio (uid 1000); o volume `dados` pertence a esse usuário.
USER node
EXPOSE 3000
# Valida o ambiente, aplica as migrações versionadas e sobe o servidor.
ENTRYPOINT ["./entrypoint.sh"]
