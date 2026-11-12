# Tasks

## 1. Imagens

- [ ] 1.1 Dockerfile multi-stage para o frontend e para o backend; `docker build` de cada um passa.

## 2. Orquestração

- [ ] 2.1 `docker-compose.yml` com os serviços de `proposal.md`, volume do banco e `.env`; `docker compose up --build` sobe tudo.
- [ ] 2.2 `.env.example` cobre toda variável usada pelos serviços; nenhum segredo nas imagens.

## 3. Verificação

- [ ] 3.1 Smoke test no ambiente subido: abrir cada entidade da navegação e criar um registro.
- [ ] 3.2 `openspec validate --all --strict` passa; arquivar esta change encerra o build.
