# DETRAN-RJ Contratos — implementação (OpenSpec)

Repositório de implementação do novo sistema de **gestão de contratos administrativos do DETRAN-RJ**,
construído por desenvolvimento orientado a specs com [OpenSpec](https://github.com/Fission-AI/OpenSpec).

> Ainda não há código de aplicação. O plano de construção está em `openspec/changes/`: cada change
> é aplicada por um agente de AI coding, verificada e arquivada, nesta ordem. A cada arquivamento,
> `openspec/specs/` passa a descrever o sistema novo.

## De onde vem

| | |
|---|---|
| **Legado** | Aplicação PHP (estilo CakePHP 1.x): 33 módulos, 42 telas, 105 regras de negócio |
| **Análise** | Plataforma RNC, workspace `48771946-086d-43f2-821f-f172b5870257` |
| **Pacote de origem** | [`edgars/detran-rj-contratos`](https://github.com/edgars/detran-rj-contratos), gerado pela RNC |
| **Ajustes neste repo** | [`docs/ajustes-ao-pacote-rnc.md`](docs/ajustes-ao-pacote-rnc.md) |
| **Levantamento** | [`docs/levantamento.md`](docs/levantamento.md) |

## Stack

| Camada | Escolha |
|---|---|
| Frontend | Next.js (App Router) + [shadcn/ui](https://ui.shadcn.com) |
| Backend | Next.js (route handlers) + Prisma |
| Banco | SQLite com migrações versionadas |
| Autenticação | Login local, senha em hash `argon2id`/`bcrypt`, sessão em cookie `httpOnly` (SSO desligado) |
| Deploy | Docker Compose |
| Locale | pt-BR, datas `dd/MM/yyyy`, moeda `R$`, máscaras de CPF e CEP |

## Ordem de construção

| # | Change | O que entrega |
|---|---|---|
| 1 | `001-project-foundation` | Scaffold, convenções de API, navegação, tabelas de referência, locale |
| 2 | `001b-security-baseline` | Login, sessão, rotas protegidas, gravação segura, upload de PDF, dinheiro em `Decimal` |
| 3 | `002-departamentos` | Departamentos |
| 4 | `003-tipo-contratos` | Tipos de contrato |
| 5 | `004-contrato-status` | Status do contrato |
| 6 | `005-users` | Usuários e troca de senha |
| 7 | `006-pagamentos` | Pagamentos |
| 8 | `007-modalidades` | Modalidades |
| 9 | `008-prestacao-contas` | Prestação de contas |
| 10 | `009-fases` | Fases |
| 11 | `010-fiscais` | Fiscais |
| 12 | `011-status` | Status |
| 13 | `012-historicos` | Históricos |
| 14 | `013-anexos-fiscais` | Anexos de fiscalização |
| 15 | `014-situacao-contratuals` | Situação contratual |
| 16 | `015-anexos-publicacaos` | Anexos de publicação |
| 17 | `016-penalidades` | Penalidades |
| 18 | `017-contratos` | Cadastro completo de contratos, aditivos e filtros |
| 19 | `018-deployment` | Dockerfiles e `docker-compose.yml` |

## Como construir

Pré-requisitos: Node.js ≥ 22.12, git, Docker com Compose e um agente de AI coding suportado
pela OpenSpec (Claude Code, Cursor, Codex, Copilot, Gemini CLI e outros).

```bash
npm install -g @fission-ai/openspec@latest   # testado com a CLI 2.0.0
openspec init --tools claude                 # gera as skills; openspec/config.yaml é preservado
openspec validate --all --strict             # precisa passar antes de abrir o agente
openspec list --changes
```

Para **cada** change, na ordem da tabela acima:

1. **Aplicar** — `/openspec-apply-change <id>` (OpenSpec 1.x: `/opsx:apply <id>`). O agente lê
   `proposal.md`, `design.md` e `specs/`, implementa `tasks.md` e marca `- [x]`.
2. **Verificar** — leia o diff. Cada regra `RK-…` tem um comentário `// RK-…` onde é aplicada, e
   cada `#### Scenario:` tem um teste. Com o perfil expandido (`openspec config profile`),
   `/openspec-verify-change <id>` confere contra as specs.
3. **Arquivar** — `/openspec-archive-change <id>` ou `openspec archive <id> --yes`. Só então
   comece a próxima change.

Sem skills, use este prompt:

> Leia `openspec/config.yaml` por inteiro e trate o bloco `context` como instruções permanentes.
> Depois leia `AGENTS.md`. Aplique a change `openspec/changes/<id>`: leia `proposal.md`,
> `design.md` e `specs/`, implemente cada item de `tasks.md` na ordem e marque `- [x]` ao concluir.
> Não invente stack, entidade ou campo que não esteja nos documentos. Ao terminar, rode
> `openspec validate <id> --strict` e pare.

Ao final:

```bash
cp .env.example .env
docker compose up --build
```

## MCP da RNC (opcional, recomendado)

Com o MCP conectado, o agente confere cada `RK-…` contra a regra do legado (`getRule`) e lê o
código original (`getSourceFile`). Nenhuma credencial fica no repositório:

```bash
export RNC_MCP_URL=https://<host-da-api-rnc>
export RNC_MCP_TOKEN=<token gerado em Settings → MCP>
```

No Claude Code, o `.mcp.json` já aponta para o servidor `rnc`.

## Regras do build

1. Uma change por vez, na ordem. Arquive antes de começar a próxima.
2. As specs são a fonte de verdade de comportamento; `proposal.md` diz o porquê e `design.md` o como.
3. As diretivas do autor em `openspec/config.yaml` vencem qualquer outro documento.
4. Nunca edite uma spec para o código passar. Se ela estiver errada, registre em `design.md` § Open Questions e pare a change.
5. Depois do build, toda evolução segue o fluxo OpenSpec: `/openspec-explore`, `/openspec-propose`, `/openspec-apply-change`, `/openspec-archive-change`.

## Decisões pendentes

- **Permissões por grupo** — `001b-security-baseline/design.md` § Open Questions.
- **Gestor e suplente do contrato** e **valor de aditivos nos relatórios** — `017-contratos/design.md` § Open Questions.
- **Relatórios gerenciais** (vencendo, vencidos, por gestor, meta, cadastro incompleto, acerto de valor) — precisam de uma change própria depois de `017-contratos`.
