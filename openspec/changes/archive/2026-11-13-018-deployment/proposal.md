# Deployment — docker-compose

## Why

Com todas as entidades construídas, a aplicação precisa subir de forma reproduzível fora da
máquina do desenvolvedor, com o modelo de deployment escolhido no canvas (docker-compose).

## What Changes

- `docker-compose.yml` na raiz: um serviço por componente — frontend (`web`), backend (`api`), banco (`db`, sqlite).
- Portas conforme o canvas (frontend 3000, API 5000 por padrão); diretiva de porta vence.
- Volume nomeado para o banco; serviços se referenciam pelo nome, nunca `localhost`.
- Dockerfiles multi-stage; imagem de produção roda o app construído, não um dev server.
- Segredos e connection strings só via `.env`.

## Capabilities

### New Capabilities

- `deployment`: subida reproduzível da aplicação completa

### Modified Capabilities

_none_

## Impact

- Última change: depende de todas as anteriores arquivadas.
- Dados persistem entre reinícios (volume nomeado do compose).
