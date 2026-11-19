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
