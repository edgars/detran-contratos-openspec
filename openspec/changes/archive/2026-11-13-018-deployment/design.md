# Design

## Context

Next.js serve frontend e API no mesmo processo, e o banco é SQLite (arquivo). A proposta previa
três serviços (`web`, `api`, `db`), que não correspondem a esta stack.

## Goals / Non-Goals

**Goals:**
- `docker compose up --build` sobe a aplicação inteira, com dados persistentes.
- Nenhum segredo nas imagens.

**Non-Goals:**
- Orquestração em nuvem ou Kubernetes.

## Decisions

- **Um serviço `app`** — o Next.js atende o frontend e `/api` na porta 3000 (`PORT`); não existe processo de API separado nem servidor de banco. O SQLite fica em `/app/data/app.db` no volume nomeado `dados`, junto com os anexos (`/app/data/uploads`).
- **Imagem multi-stage** — `deps` (npm ci) → `build` (prisma generate + next build, saída `standalone`) → `run` (só o app construído, `NODE_ENV=production`). O start aplica `prisma migrate deploy` e sobe `node server.js`.
- **Segredos só no ambiente** — `.env` fica fora do contexto de build (`.dockerignore`) e entra por `env_file` em tempo de execução.
- **Verificação** — `scripts/smoke.mjs` testa login, as 19 páginas, as APIs, a ausência de senha na API e, com `SMOKE_CREATE`/`SMOKE_ONLY_CHECK`, que um registro sobrevive a `docker compose restart`. O segredo e a senha do admin foram procurados nas camadas da imagem (`docker history` e `docker save`): nenhuma ocorrência.
- **`COOKIE_SECURE=false`** — só para acesso por HTTP sem TLS (ex.: teste local); em produção atrás de HTTPS, deixe sem definir.

## Risks / Trade-offs

- [SQLite com um único processo] → adequado ao volume do legado; escalar horizontalmente exige trocar de banco.
