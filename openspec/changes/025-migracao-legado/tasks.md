# Tasks

## 0. Pré-condições

- [ ] 0.1 Conferir que `022-pessoas-fornecedores` e `023-perfis-acesso` estão arquivadas e que existem `PessoaFisica.cpf`, `PrestadorServico.cnpj`, `MigracaoPendencia`, `UserPerfil`, `src/lib/auth/perfis-legado.ts` (`perfisDoLegado`) e `scripts/resolver-cpf-gestores.mjs`; também `tipo_contrato.prestacaoContas` (021). Verificação: `openspec list` sem 022/023 ativas e `grep -n "cpf\|cnpj\|UserPerfil\|prestacaoContas" prisma/schema.prisma`.

## 1. Modelo de dados e dependências

- [ ] 1.1 Migração `prisma/migrations/<timestamp>_025_migracao_legado/` com `migracao_execucoes`, `migracao_arquivos` e `users.senhaRedefinir` (design.md › D11); modelos no `prisma/schema.prisma`. Verificação: `npx prisma migrate dev --name 025_migracao_legado` aplica sem erro e `npx prisma validate` passa.
- [ ] 1.2 `package.json`: devDependency `tsx` e script `"migrar": "tsx scripts/migrar.ts"`; `.gitignore` com `import/`. Verificação: `npm run migrar -- --help` imprime as opções.

## 2. Parser do dump

- [ ] 2.1 `src/lib/migracao/dump-parser.ts` em stream: `USE`/`CREATE DATABASE`, `CREATE TABLE` (colunas, tipos, `PRIMARY KEY`), `INSERT` simples e estendido, escapes do MySQL, `NULL`, hex; valores só texto/nulo; banco pelo `USE` ou pelo nome do arquivo; tabela ambígua; `--encoding`. Verificação: `tests/migracao-parser.test.ts` com cenários *Dump com várias linhas por INSERT* e *Arquivo que não é dump*, mais casos de cada escape, `0x…`, `INSERT` com lista de colunas e UTF-8 inválido.
- [ ] 2.2 `tests/helpers/dump-sintetico.ts`: gerador dos dumps `contratos.sql` e `global.sql` e da pasta de anexos de design.md › D12 (opções para variar cada caso). Verificação: usado por todos os testes `tests/migracao-*.test.ts`; um teste confere que o dump gerado é lido sem erro pelo parser.

## 3. Mapa e conversões

- [ ] 3.1 `src/lib/migracao/mapa.ts` com as 25 tabelas de design.md › D4, regra de nomes e exceções de D3 (`pessoa_fisica_CPF`, `CPF`, `CNPJ`, `password` ignorado). Verificação: `tests/migracao-mapa.test.ts` confere que toda coluna obrigatória de cada modelo Prisma de destino tem origem no mapa (lendo `Prisma.dmmf`).
- [ ] 3.2 Conferência do mapa contra o `CREATE TABLE` (D3). Verificação: cenários *Coluna renomeada no dump real* e *Coluna a mais no dump*.
- [ ] 3.3 `src/lib/migracao/conversoes.ts` (`dinheiro`, `data`, `dataHora`, `cpf`, `cnpj`, `simNao`, `zeroUm`, `texto`) de D5; `dinheiro` com `new Prisma.Decimal(texto).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)` e sem `Number`/`parseFloat` (checagem: `grep -n "parseFloat\|Number(" src/lib/migracao/conversoes.ts` sem ocorrência em dinheiro). Verificação: `tests/migracao-conversoes.test.ts` com tabela de casos de cada conversor e cenários *Valor com três casas*, *Resíduo de FLOAT*, *Valor exato*, *Data zerada em coluna opcional*, *Data zerada em coluna obrigatória* (`RK-774f44ed6df9` citada no teste e no ponto da rejeição em `carga.ts`) e *Indicador de prestação de contas*.

## 4. Carga

- [ ] 4.1 `src/lib/migracao/carga.ts` › `executarCarga(opcoes)`: ordem de D4, upsert por chave com contagem inserido/atualizado/inalterado, transação única, `existentesForaDoDump`, rejeição "contrato inexistente". Verificação: cenário *Pagamento de contrato inexistente*.
- [ ] 4.2 Pessoas e fornecedores (D4 passos 3–4, D5): normalização, escolha da linha em CPF duplicado, tradução CNPJ → `id`, pendência em `migracao_pendencias` com `origem='025'`, avisos de DV com as funções de `src/lib/documento.ts` (022). Verificação: cenários *CPF numérico sem zero à esquerda*, *CNPJ com máscara*, *CNPJ sem fornecedor* e *CPF duplicado no global*; teste de recarga conferindo que o `id` do fornecedor não muda.
- [ ] 4.3 Contratos e aditivos em ordem topológica, `valorInicial` copiado sem recalcular (comentário `// RK-c3fbde6dbf4a não se aplica na carga: ver design.md D5` em `carga.ts`). Verificação: cenários *Aditivo antes do original no dump*, *Aditivo órfão* e *Original sem valor inicial*.
- [ ] 4.4 `contrato_status` com `status_id` obrigatório: comentário `// RK-a7017eb6c42d` e `// RK-067d06861847` no ponto da rejeição em `carga.ts`. Verificação: teste com andamento sem `status_id` rejeitado, citando as duas chaves.
- [ ] 4.5 Tipos de contrato com `prestacaoContas = "S"` para ids 3–11 e 13 (021, `docs/legado/prestacao-contas.md`) e `indicativoMetaRisco` S/N. Verificação: teste com tipos 3, 12 e 13 no dump sintético.
- [ ] 4.6 Pendências de cadastro (D8) com as chaves `RK-79134600b4be`, `RK-776d8b62d6df`, `RK-04fd1cbfc346`, `RK-6b2806cfff8d`, `RK-9d6599f5897d`, `RK-a0660a4fb262`, `RK-37f294a3dc8e`, cada uma comentada no ponto de `src/lib/migracao/relatorio.ts` que gera o aviso. Verificação: cenário *Contrato sem número de processo* e um teste por chave; `tests/rk-coverage.test.ts` continua passando.
- [ ] 4.7 Aviso `texto_acima_do_limite` para processo/contrato > 45, objeto > 200 e nº da modalidade > 12 (limites da 020). Verificação: teste com objeto de 250 caracteres gravado inteiro e com aviso.

## 5. Anexos

- [ ] 5.1 `src/lib/migracao/anexos.ts`: índice recursivo por basename, ambiguidade por SHA-256, leitura, `savePdf()` com `Blob` do arquivo, `migracao_arquivos` para idempotência, limpeza dos arquivos gravados se a transação falhar, modo simulação sem gravar. Verificação: cenários *PDF válido* (inclui download por `/api/arquivos/<nome>` com sessão de Administrador e comparação de SHA-256), *Imagem renomeada para .pdf*, *Anexo fiscal sem arquivo* (`RK-0e70b6c81ee9`/`RK-9da08201400b` citadas no teste) e *Sem pasta de anexos*.
- [ ] 5.2 Colunas cobertas: `contratos.anexo`, `contratos.projetoBasico` (020), `anexos_fiscais.anexo`, `anexos_publicacao.anexo`, `penalidades.arquivo`, `pagamento_arquivos.arquivo` (`RK-77287deac605` no ponto da rejeição). Verificação: teste com um arquivo por coluna no dump sintético.

## 6. Usuários e perfis

- [ ] 6.1 `src/lib/migracao/usuarios.ts`: criação inativa com `senhaRedefinir = true` e hash de 32 bytes aleatórios (`hashPassword` de `src/lib/auth/password.ts`), `password` do legado descartado no parser, usuário existente preservado, mapa `usuarioLegado → id`. Verificação: cenários *Login de usuário migrado*, *Senha fora do relatório* (busca do texto em relatório, stdout capturado e `sqlite3 .dump` do banco de teste) e *Usuário já existente*.
- [ ] 6.2 Perfis com `perfisDoLegado()` + `superuser` + `CONSULTA` (023), `gruposSemMapeamento`. Verificação: cenários *Usuário em dois grupos* e *Grupo desconhecido*.
- [ ] 6.3 Autoria e usuário técnico `legado.desconhecido`. Verificação: cenário *Penalidade de autor removido* e teste de histórico com autor desconhecido gravado com `usuarioId` nulo.
- [ ] 6.4 `src/lib/auth/login.ts` recusa `senhaRedefinir = true` com `LOGIN_FAILED`. Verificação: coberto pelo cenário *Login de usuário migrado*; `tests/security.test.ts` continua passando.
- [ ] 6.5 Tela `/users/[id]/senha` (`src/app/(app)/users/[id]/senha/page.tsx`, `EntityForm` com campos `password` e `passwordconfirm`, componentes shadcn/ui do kit) e `POST /api/users/[id]/senha` (schema `zod` estrito, permissão de Administrador da 023, `hashPassword`, `senhaRedefinir = false`, `inativo = 0`, resposta sem senha); link "Definir senha" na edição do usuário. Verificação: `tests/users-senha.test.ts` com os cenários *Ativar usuário vindo do legado*, *Confirmação diferente* e *Sem perfil Administrador*; `senhaRedefinir` fora do schema de `PUT /api/users/:id` (teste: enviar o campo → `400`).

## 7. Simulação, proteções e relatório

- [ ] 7.1 `--simular` com rollback por erro sentinela e registro em `migracao_execucoes` fora da transação; `--confirmar` obrigatório. Verificação: cenários *Simulação não grava* e *Carga real sem confirmação*.
- [ ] 7.2 Backup `VACUUM INTO` antes da carga real; recusa com dados do app sem carga anterior; recusa com sessão recente. Verificação: cenários *Banco com dados criados no app* e *Falha no meio da carga* (erro injetado por opção de teste no passo de pagamentos; confere tabelas vazias, arquivos removidos e backup presente).
- [ ] 7.3 `src/lib/migracao/relatorio.ts`: JSON de D8, resumo no terminal, códigos de saída 0/2/1. Verificação: cenários *Somatórios batem*, *Contagens fecham* (asserção em todas as tabelas de toda execução dos testes) e *Execução com rejeições*.
- [ ] 7.4 Idempotência. Verificação: cenários *Segunda execução igual* (inclui contagem de arquivos em `UPLOAD_DIR` antes e depois), *Dump mais novo* e *Novo registro depois da carga*.
- [ ] 7.5 Ao fim da carga real, executar `scripts/resolver-cpf-gestores.mjs` (022) e anexar a saída ao relatório. Verificação: teste confere a seção `resolvedorGestores` no relatório.

## 8. Comando e compose

- [ ] 8.1 `scripts/migrar.ts`: argumentos de D2, `--help`, chama `executarCarga`. Verificação: `npm run migrar -- --origem <dump sintético> --origem <global sintético> --simular` num banco de desenvolvimento termina com `0` e imprime o resumo.
- [ ] 8.2 Alvo `migrar` no `Dockerfile` e serviço `migrar` no `docker-compose.yml` (perfil `migracao`, volumes `dados` e `./import:/import:ro`, sem portas). Verificação: `docker compose --profile migracao run --rm migrar --origem /import/contratos.sql --origem /import/global.sql --simular` com os dumps sintéticos copiados para `./import/` termina com `0`; `docker compose up -d` sem o perfil não sobe `migrar`.
- [ ] 8.3 Seção "Carga do legado" para o runbook da 026 descrita em `design.md` (pedido do `mysqldump`, cópia dos anexos, simulação, conferência do relatório com o financeiro, carga real com o app parado, ativação dos usuários). Verificação: checagem manual; o texto é incorporado a `docs/operacao.md` pela 026.

## 9. Verificação final

- [ ] 9.1 Um teste por `#### Scenario:` de `specs/migracao-legado/spec.md` e `specs/users/spec.md`, todos verdes com `npx vitest run tests/migracao tests/users-senha`.
- [ ] 9.2 `npm test`, `npx tsc --noEmit`, `npm run lint` e `OPENSPEC_TELEMETRY=0 npx -y @fission-ai/openspec@latest validate 025-migracao-legado --strict` passam.
- [ ] 9.3 Quando o dump real chegar (fora desta change, registrado aqui): primeira execução com `--simular`, ajuste de `mapa.ts` conforme as divergências da conferência (D3), e Open Questions de design.md respondidas. Verificação: relatório da simulação anexado ao PR do ajuste.
