# deployment Specification

## Purpose
Subida da aplicação TDOC - Processos Detran como um todo, com docker-compose: dados persistentes e configuração só por ambiente.

## Requirements

### Requirement: Subir a stack completa
O sistema SHALL subir frontend, API e banco com um único comando (`docker compose up --build`) e SHALL manter os dados entre reinícios.

#### Scenario: Primeiro start
- **WHEN** o operador roda `docker compose up --build` com um `.env` preenchido
- **THEN** o frontend responde na porta configurada, a API responde `/api` e um registro criado sobrevive a um reinício

### Requirement: Sem segredo em imagem
As imagens SHALL NOT conter segredo ou connection string; tudo SHALL vir do ambiente em tempo de execução.

#### Scenario: Inspecionar a imagem
- **WHEN** as camadas da imagem são inspecionadas
- **THEN** nenhum valor de `.env` aparece nelas
