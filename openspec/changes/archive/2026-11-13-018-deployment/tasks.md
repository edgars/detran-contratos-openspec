# Tasks

## 1. Imagens

- [x] 1.1 Dockerfile multi-stage para o frontend e para o backend; `docker build` de cada um passa.

## 2. Orquestração

- [x] 2.1 `docker-compose.yml` com os serviços de `proposal.md`, volume do banco e `.env`; `docker compose up --build` sobe tudo.
- [x] 2.2 `.env.example` cobre toda variável usada pelos serviços; nenhum segredo nas imagens.

## 3. Verificação

- [x] 3.1 Smoke test no ambiente subido: abrir cada entidade da navegação e criar um registro.
- [x] 3.2 `openspec validate --all --strict` passa; arquivar esta change encerra o build.
