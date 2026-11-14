# Base de segurança

## Why

A análise de segurança da RNC deu nota 55/100 (risco alto) ao legado: 112 achados, 6 críticos.
Os críticos são sessão aceita pela URL, controllers inteiros sem login e PHP sem suporte.
O pacote gerado deixou a autenticação como questão aberta. Esta change fecha essa questão
antes de qualquer entidade, para que nenhuma change de entidade reproduza as falhas do legado.

Evidência no legado (RNC, workspace `48771946-086d-43f2-821f-f172b5870257`):

| Achado | Severidade | Onde |
|---|---|---|
| Sessão tirada da URL (`session_id($_GET['sessionId'])`) | Crítica | `libs/vendors/plugins/detran/controllers/components/util.php:32-33` |
| Todas as ações sem login (`allowedActions = array('*')`) | Crítica | `app/controllers/users_controller.php:47`, `plugins/detran/controllers/users_controller.php:22`, `pagamento_arquivos_controller.php:9` |
| Ações que alteram dados sem login | Alta | `tipo_contratos_controller.php:20` e `:37` |
| Nome do campo gravado vindo da requisição (`saveField($campo, …)`) | Alta | `contrato_status_controller.php:68` |
| Senha sem garantia de hash | Alta | tela `users/login` |
| SQL montado por concatenação (3 ocorrências) | Média | relatórios e consultas do legado |
| Valores monetários em FLOAT | — | `pagamentos.valor`, `pagamentos.valor_glosa` |

## What Changes

- Login local com usuário e senha; toda página e toda API exigem sessão, exceto `/login`.
- Sessão emitida e renovada só pelo servidor, em cookie `httpOnly`.
- Senhas guardadas só como hash e nunca devolvidas pela API.
- Gravação por lista de campos permitidos em toda entidade.
- Uploads de PDF conferidos pelo conteúdo, com limite de tamanho e acesso autenticado.
- Autoria (`user_id`) preenchida a partir da sessão.
- Consultas sempre parametrizadas.
- Valores monetários em `Decimal`.

## Capabilities

### New Capabilities

- `security`: autenticação, sessão, proteção de rotas, gravação segura, uploads e dinheiro

### Modified Capabilities

_none_

## Impact

- Middleware de autenticação do Next.js e tela `/login`.
- Utilitários compartilhados que todas as changes de entidade usam: validação por schema, upload e formatação de dinheiro.
- A tabela `users` ganha `passwordHash`; `password` em texto nunca é gravado.

## Fora de escopo

- SSO (continua desligado no canvas).
- Permissões por grupo (`groups`, `groups_users`, `aco_id`): o legado associa usuários a grupos por sistema, mas a regra de autorização não foi rastreada. Fica em Open Questions do `design.md`.
- Migração das senhas do legado: o algoritmo de hash do legado não foi confirmado.
