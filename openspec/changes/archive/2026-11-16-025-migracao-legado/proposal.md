# Migração dos dados do legado

Depende de: `022-pessoas-fornecedores` (colunas `cpf`/`cnpj`, formato só dígitos, `migracao_pendencias`, `scripts/resolver-cpf-gestores.mjs`) e `023-perfis-acesso` (`user_perfis`, `perfisDoLegado()`). Pela ordem da onda, também assume arquivadas `019`, `020` (projeto básico em PDF, `naPresidencia`), `021` (`tipo_contrato.prestacaoContas`, `atendido` S/N) e `024` (registro de arquivos do kit).

## Why

O sistema novo só substitui o legado quando os contratos, aditivos, pagamentos, fiscais, anexos e históricos que estão hoje no MySQL do DETRAN-RJ (bancos `contratos` e `global`) estiverem nele, conferidos. Decisão do autor (13/11/2026, `openspec/config.yaml`): **ainda não há dump; a 025 entrega o carregador e as checagens, executados quando o dump chegar.** Por isso o carregador precisa ser testado sem o dump real (com um dump sintético gerado no teste), conferir o próprio mapeamento contra o `CREATE TABLE` do dump verdadeiro antes de gravar, e poder rodar em simulação quantas vezes for preciso.

Pontos do legado que exigem tratamento explícito (`docs/levantamento.md`, `docs/legado/*.md`):

- Valores monetários em `FLOAT` no legado; no app novo são `Decimal` (diretiva do autor) — a conversão arredonda e precisa ficar registrada.
- Gestor, suplente e fiscal são ligados por **CPF** e o fornecedor por **CNPJ**, atravessando para o banco `global` (`docs/legado/chaves-pessoas-fornecedores.md`).
- O destino físico dos anexos do legado não foi identificado (`docs/levantamento.md` › Riscos); os PDFs ficam no servidor antigo.
- O hash de senha do legado não está confirmado ("senha sem garantia de hash", `docs/levantamento.md` › Segurança): nenhuma senha migra.
- Grupos do ACL (`Gestor`, `Pagamentos`, `ContratoCGCL`, `PrestacaoConta`) viram perfis pelo mapeamento da 023 (`docs/legado/perfis-acesso.md`).

## What Changes

- **Formato de entrada: dump `.sql` do `mysqldump`** (um arquivo por banco, `contratos` e `global`), lido por um parser próprio que entende `CREATE TABLE` e `INSERT INTO … VALUES` (inclusive *extended insert*); nenhum servidor MySQL é necessário.
- **Comando** `npm run migrar -- --origem <contratos.sql> --origem <global.sql> [--anexos <pasta>] [--simular] [--confirmar]`, também disponível no compose como serviço `migrar` (perfil `migracao`).
- **Mapa de colunas** legado → modelo atual, num arquivo (`src/lib/migracao/mapa.ts`), **conferido contra o `CREATE TABLE` do dump** antes de gravar: coluna esperada ausente aborta a carga sem gravar nada.
- **Ordem de carga**: referências (diretorias, departamentos, pessoas físicas por CPF, prestadores por CNPJ, pessoas), tabelas auxiliares (tipos, modalidades, situações, status, fases), grupos e usuários, e então contratos originais, aditivos (`parent_id`), andamentos (`contrato_status`), fiscais, pagamentos e arquivos de pagamento, históricos, prestação de contas, penalidades, anexos fiscais e de publicação.
- **Idempotência**: chave natural por tabela (id do legado preservado, `cpf`, `cnpj`, `username`); rodar de novo o mesmo dump não duplica nada e não altera nada.
- **Dinheiro**: `FLOAT` → `Decimal` lido do texto do dump (nunca por `Number`), arredondado a 2 casas (meio para cima) e cada arredondamento registrado no relatório.
- **Anexos**: pasta copiada do servidor antigo (`--anexos`), localização por nome do arquivo, verificação `%PDF-` e gravação por `savePdf()`; ausentes e inválidos vão para o relatório.
- **Usuários**: criados **inativos**, sem senha migrada (hash aleatório descartado), marcados para redefinição; perfis pelo `perfisDoLegado()` da 023. Nova ação do Administrador "Definir senha e ativar" em `/users/[id]/senha`.
- **Relatório de conferência** (JSON + resumo no terminal): contagens lidas/inseridas/atualizadas/inalteradas/rejeitadas por tabela, somatórios de valores na origem e no destino, arredondamentos, rejeitados com motivo, avisos (CPF/CNPJ sem referência, DV inválido, anexos ausentes, pendências de cadastro com a chave `RK-…`).
- **Simulação** (`--simular`): roda tudo numa transação desfeita no fim, sem copiar arquivos, e produz o mesmo relatório.
- **Proteções**: backup do banco (`VACUUM INTO`) antes de toda carga real; carga real exige `--confirmar`; recusa rodar se o banco já tiver contratos criados fora da carga.
- Tabela `migracao_execucoes` (histórico das execuções) e `migracao_arquivos` (anexos já importados); `migracao_pendencias` da 022 é reaproveitada.

## Capabilities

### New Capabilities

- `migracao-legado`: carga idempotente do dump MySQL do legado (bancos `contratos` e `global`) e dos PDFs, com mapa de colunas conferido, conversões (dinheiro, datas, CPF/CNPJ, S/N), usuários inativos sem senha e perfis mapeados, simulação, backup prévio e relatório de conferência.

### Modified Capabilities

- `users`: o Administrador define a senha e ativa um usuário que veio do legado (ação nova; os requisitos existentes não mudam).

## Impact

- **Banco**: migração Prisma `025_migracao_legado` — tabelas `migracao_execucoes` e `migracao_arquivos`, coluna `users.senhaRedefinir Boolean @default(false)`.
- **Código novo**: `src/lib/migracao/{dump-parser,mapa,conversoes,anexos,carga,relatorio,usuarios}.ts`, `scripts/migrar.ts`, `src/app/(app)/users/[id]/senha/page.tsx`, `src/app/api/users/[id]/senha/route.ts`.
- **Código alterado**: `package.json` (script `migrar`, devDependency `tsx`), `Dockerfile` (alvo `migrar`), `docker-compose.yml` (serviço `migrar`, perfil `migracao`), `src/lib/entities/users.server.ts` (`senhaRedefinir` fora do schema de escrita e do `serialize`), `src/lib/auth/login.ts` (recusa `senhaRedefinir`), `.gitignore` (`import/`).
- **Testes**: `tests/migracao-*.test.ts` com dump sintético gerado no próprio teste e PDFs de teste.
- **Coordenação**: a `026-producao` mantém o serviço `migrar` no compose e o runbook (`docs/operacao.md`) aponta para o procedimento desta change.

## Fora de escopo

- Conexão direta ao MySQL do legado, CSV por tabela ou sincronização contínua com o banco `global`: a entrada é só o dump `.sql`.
- Migrar senhas ou reconhecer o hash do legado; envio de e-mail de redefinição.
- Migrar o ACL do CakePHP (`acos`, `aros`, `aros_acos`): só os grupos e a associação usuário–grupo entram, para o mapeamento de perfis.
- Apagar no destino registros que sumiram do legado entre dois dumps (são só listados no relatório).
- Corrigir dados do legado (CPF com DV inválido, contratos sem campo obrigatório, textos acima dos limites): entram como estão e vão para o relatório.
- Tela de acompanhamento da carga na interface; o relatório é arquivo e terminal.
- Tabelas do legado sem tabela correspondente no modelo atual (as que não aparecem em `001-project-foundation/design.md` › Modelo de dados).
