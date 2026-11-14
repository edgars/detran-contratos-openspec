# Fundação do projeto — TDOC - Processos Detran

## Why

O sistema legado será reconstruído em uma stack moderna. Antes de qualquer entidade, o
repositório precisa do scaffold, das convenções de API e UI que todas as changes seguintes
assumem e das tabelas de referência que as telas usam como dropdown. Esta change existe para
que as changes de entidade sejam só domínio.

## What Changes

- Scaffold do frontend (nextjs + shadcn/ui) e do backend (nextjs) com prisma, na estrutura de `design.md`.
- Banco sqlite: migrações versionadas, uma por change.
- Convenções: REST em `/api/<entidade>`, paginação, contrato de erro de validação.
- Navegação principal listando cada entidade gerenciada.
- Tabelas de referência (`diretorias`, `pessoas_fisicas`, `pessoas`, `prestadores_servicos`, `groups_users`, `pagamento_arquivos`, `groups`) com API somente leitura — sem tela de edição.
- Variáveis de ambiente documentadas em `.env.example`.
- Locale pt-BR: datas `dd/MM/yyyy`, símbolo de moeda `R$`; máscaras de entrada e serviços de endereço conforme `design.md` § Máscaras de campo e serviços.

## Capabilities

### New Capabilities

- `app-shell`: navegação, convenções de API, configuração e dados de referência
- `locale-and-formats`: locale, formatos de data e moeda, máscaras de entrada e os serviços de endereço que os formulários usam
- `cross-cutting-rules`: regras de negócio do legado que não pertencem a uma única entidade

### Modified Capabilities

_none_

## Impact

- Novo repositório; nenhum código existe antes desta change.
- Toda change seguinte depende das convenções fixadas aqui.

## Fora de escopo — regras sem entidade neste build

Regras extraídas do legado cujos campos e tabelas não existem em nenhuma entidade deste
build. Ficam registradas para decisão de produto; nenhuma change as implementa.

As regras de `contratos` que estavam nesta lista (obrigatórios do cadastro, valores derivados e anexos de publicação e fiscal) foram movidas para `017-contratos`.

- `RK-0a63dddb4ed6` diretoria_id is required
- `RK-ab7a3a8ef0b4` Erro ao associar. Grupo não foi informado!
- `RK-69182a6c3643` Erro ao associar. Usuário não foi informado!
- `RK-2fbb6e6f7b74` Erro ao associar. Sistema não foi informado!
- `RK-e063e8635252` group_id is required
- `RK-2cf787a80b4d` user_id is required
- `RK-73a4fe8389f5` pagamento_id is required
- `RK-b8a8c6859f3c` indicativo_meta_risco is required
- `RK-db3fcef57379` contrato_id is required
- `RK-c30e99d60dd1` pessoa_id is required
- `RK-1f79f717e41d` numero_processo is required
- `RK-ab0a1d58d625` contrato_id is required
- `RK-583ca876ba20` fase_id is required
- `RK-61312a1f33c7` user_id is required
- `RK-74b2c2d34ba8` contrato_id is required
- `RK-d70d85fc4d8d` Data Inclusao is derived before saving
- `RK-cd62b9b73a3a` contrato_id is required
- `RK-a76399cd79e3` pessoa_fisica_CPF is required
- `RK-b3a62226d1f3` contrato_id is required
- `RK-211b91bb389e` Data Registro is derived before saving
- `RK-cc289ca3037f` data_registro is required
- `RK-d4e9018bdb4c` contrato_id is required
- `RK-5275536714f2` diretoria_id is required
- `RK-0930f0eacde6` Informe o sistema!
- `RK-8a0de7e0bd25` contrato_id is required
- `RK-67e5fc858327` data_publicacao is required
- `RK-2e913a11353e` data_registro is required
- `RK-173858674ac1` contrato_id is required
- `RK-400c6f977aa8` user_id is required
- `RK-e43e0c864331` contrato_id is required
- `RK-08a4781c828d` data_publicacao is required
- `RK-a2970c62326d` diretoria_id is required
- `RK-3e5bb5e37daa` data_registro is required
- `RK-68f54cee895a` indicativo_meta_risco is required
- `RK-4d92715dd552` pessoa_id is required
- `RK-6cb5379cf339` Erro ao associar. Grupo não foi informado!
- `RK-58fcf23c8ddd` Erro ao associar. Usuário não foi informado!
- `RK-4af817d9ba93` Erro ao associar. Sistema não foi informado!
- `RK-d455ac610ae7` group_id is required
- `RK-8182194164c7` user_id is required
