# Design

## Context

- **Origem**: MySQL do legado, bancos `contratos` (tabelas do sistema) e `global` (`pessoas_fisicas`, `prestadores_servicos`, `departamentos`, compartilhado com outros sistemas do DETRAN-RJ — `docs/legado/chaves-pessoas-fornecedores.md`). Não há dump ainda (decisão do autor, 13/11/2026).
- **Esquema do legado conhecido**: o modelo de `001-project-foundation/design.md` › Modelo de dados foi gerado pela RNC a partir das tabelas do legado (nomes de tabela = `@@map` do `prisma/schema.prisma`; colunas convertidas para camelCase). Nomes originais confirmados em `docs/legado/*.md`: `contratos.parent_id`, `data_inicio`, `data_termino`, `valor_total`, `valor_inicial`, `valor_mensal`, `tipo_contrato_id`, `departamento_id`, `pessoa_fisica_id`, `suplente_id`, `prestador_servico_id`, `prestacao_realizada`, `na_presidencia`, `projeto_basico`, `anexo`; `fiscais.pessoa_fisica_CPF`; `contrato_status.descricao`/`atendido`/`status_id`; `fases.periodo`; `tipo_contrato.indicativo_meta_risco`; no `global`, colunas em PascalCase (`CPF`, `CNPJ`, `DeRazaoSocial`, `IdPessoaFisica`, `DeNome`, `DtNascimento`, `DeDepartamento`, `DeDiretoria`, `Codigo` — evidência também nos nomes das regras `RK-32ab70ab3174` "IdPessoaFisica is required", `RK-afd830d80ecf` "DeRazaoSocial is required", `RK-4e6358dbafbf` "DeDepartamento is required", `RK-db6786831c50` "DeDiretoria is required", `RK-4b678b1a2fb6` "Codigo is required").
- **Destino**: SQLite pelo Prisma (`prisma/schema.prisma`), depois de 019–024 arquivadas. Contratos de dados que outras changes já fixaram para esta carga:
  - **022** (`022-pessoas-fornecedores/design.md` › D1, D3, D8): CPF/CNPJ só dígitos com zeros à esquerda (11/14); `pessoas_fisicas` por upsert em `cpf`, `prestadores_servicos` por upsert em `cnpj` (nunca apagar e recriar, preserva `id`); `contratos.pessoaFisicaId`/`suplenteId` e `fiscais.pessoaFisicaCpf` recebem o CPF **mesmo que não exista em `pessoas_fisicas`** (sem FK; vira aviso); `contratos.prestador_servico_id` (CNPJ) é traduzido para `prestadores_servicos.id`, CNPJ sem fornecedor é erro de checagem; DV inválido é aviso; CPF duplicado no `global`: vale a linha com `DtExcluido` nulo e maior `IdPessoaFisica`; ao fim roda `scripts/resolver-cpf-gestores.mjs`; tabela `migracao_pendencias` reaproveitável.
  - **023** (`023-perfis-acesso/design.md` › Seed e migração): `user_perfis`; `perfisDoLegado(nomesDosGrupos)` em `src/lib/auth/perfis-legado.ts` (`ContratoCGCL` → `ADMINISTRADOR`, `Gestor` → `GESTOR_CONTRATO`, `PrestacaoConta` → `GESTOR_CONTRATO`, `Pagamentos` → `FINANCEIRO`); `superuser = 1` → `ADMINISTRADOR`; sem perfil → `CONSULTA`; `groups`/`groups_users` continuam como referência somente leitura e são a origem do mapeamento.
  - **020** (`020-contratos-complementos/proposal.md` › Impact): `projeto_basico` vira PDF gravado por `savePdf()` (ou `NULL`); `na_presidencia` → `1`/`0`.
  - **021** (`021-prestacao-contas-fluxo/proposal.md` › Impact): `tipo_contrato.prestacaoContas = "S"` nos tipos 3, 4, 5, 6, 7, 8, 9, 10, 11 e 13 (lista fixa do legado, `docs/legado/prestacao-contas.md`); `prestacao_realizada` 0/1 → `"0"`/`"1"`; `prestacao_contas.atendido` 0/1 → `"N"`/`"S"`.
- **Anexos**: PDFs no servidor antigo, pasta não identificada (`docs/levantamento.md` › Riscos e lacunas). No app novo, só nomes gerados por `savePdf()` (`<uuid>.pdf`) são servidos (`src/lib/uploads.ts` › `STORED_NAME`).
- **Senhas**: hash do legado não confirmado (`docs/levantamento.md` › Segurança: "senha sem garantia de hash"). Diretiva: nunca listar, devolver ou logar `password`/`passwordHash`.

## Goals / Non-Goals

**Goals:**
- Um comando, testado sem o dump real, que carrega o dump quando ele chegar e prova (relatório) que nada se perdeu.
- Rodar de novo é seguro: mesmo dump → nada muda; dump mais novo (antes da virada) → atualiza.
- Falhar cedo e sem gravar quando o dump real não bater com o mapa.

**Non-Goals:**
- Corrigir dados do legado; sincronizar com o `global` depois da virada; migrar senhas; tela de acompanhamento.

## Decisions

### D1. Entrada: dump `.sql` do `mysqldump` (não CSV)

- **Decisão**: o carregador lê arquivos produzidos por `mysqldump --single-transaction --default-character-set=utf8mb4 --hex-blob <banco>` (um arquivo por banco). Comando para o DETRAN-RJ gerar, no runbook: `mysqldump … contratos > contratos.sql` e `mysqldump … global diretorias departamentos pessoas_fisicas prestadores_servicos pessoas > global.sql`.
- **Por quê**: é o artefato padrão que o órgão sabe gerar ("dump"), um comando por banco, consistente num ponto no tempo (`--single-transaction`), e traz o `CREATE TABLE` — que permite conferir o mapa de colunas automaticamente (D3). CSV por tabela exigiria ~25 exportações manuais, perderia tipos e `NULL` (ambíguo com vazio) e não teria o esquema para conferência.
- **Parser** (`src/lib/migracao/dump-parser.ts`): leitura em *stream* linha a linha (o `global.pessoas_fisicas` pode ser grande); reconhece `USE`/`CREATE DATABASE` (banco corrente), `CREATE TABLE` (colunas na ordem, tipo, `PRIMARY KEY`) e `INSERT INTO \`t\` [(cols)] VALUES (…),(…);` com strings entre aspas simples e escapes do MySQL (`\\`, `\'`, `\"`, `\n`, `\r`, `\t`, `\0`, `\Z`, `''`), `NULL`, números e `0x…` (hex). Todo valor sai como **texto** ou `null` — nunca como `number` (dinheiro não passa por ponto flutuante). Ignora comentários, `LOCK TABLES`, `SET`, `DROP`, `ALTER … KEYS`.
- **Banco de cada tabela**: o do último `USE` do arquivo; sem `USE`, o nome do arquivo (`contratos*.sql` → `contratos`, `global*.sql` → `global`); tabela com o mesmo nome em dois bancos sem `USE` → erro fatal "tabela ambígua".
- **Codificação**: `--encoding utf8|latin1` (padrão `utf8`). Texto com sequência UTF-8 inválida no modo `utf8` → erro fatal sugerindo `--encoding latin1` (ver Open Questions).
- Arquivo sem nenhum `CREATE TABLE` reconhecido → erro fatal "não parece um dump do mysqldump".

### D2. Comando

```
npm run migrar -- --origem <arquivo.sql> [--origem <arquivo.sql> …]
                  [--anexos <pasta>] [--encoding utf8|latin1]
                  [--simular] [--confirmar] [--relatorio <arquivo.json>]
```

- `scripts/migrar.ts` (executado por `tsx`, nova devDependency) só lê argumentos e chama `executarCarga(opcoes)` de `src/lib/migracao/carga.ts`, que é o que os testes usam.
- Sem `--simular` e sem `--confirmar` → recusa ("rode antes com --simular e confira o relatório; para gravar, use --confirmar").
- Banco de destino = `DATABASE_URL`; pasta de anexos de destino = `UPLOAD_DIR` (os mesmos do app).
- **Produção (compose)**: alvo `migrar` no `Dockerfile` (a partir do estágio `build`, que tem `node_modules`, `tsx` e o código) e serviço `migrar` no `docker-compose.yml`, perfil `migracao`, com os volumes `dados:/app/data` e `./import:/import:ro`: `docker compose --profile migracao run --rm migrar --origem /import/contratos.sql --origem /import/global.sql --anexos /import/anexos --simular`. O app deve estar parado durante a carga real (`docker compose stop app`); o comando confere que não há sessão criada nos últimos 5 minutos e, se houver, recusa (proxy de "app em uso").
- Códigos de saída: `0` concluída sem rejeição; `2` concluída com rejeições (relatório lista); `1` abortada (nada gravado).

### D3. Mapa de colunas conferido contra o dump

- `src/lib/migracao/mapa.ts` declara, por tabela de destino: banco e tabela de origem, chave de idempotência, ordem, e por coluna de destino a coluna de origem e o conversor (`texto`, `inteiro`, `data`, `dataHora`, `dinheiro`, `cpf`, `cnpj`, `simNao`, `zeroUm`, `anexo`, `usuario`, `ignorar`).
- **Regra de nomes** (exceções explícitas no arquivo): tabela de origem = `@@map` do modelo; coluna de origem no banco `contratos` = camelCase → snake_case (`numeroProcesso` → `numero_processo`); no banco `global` = primeira letra maiúscula (`deNome` → `DeNome`, `idPessoaFisica` → `IdPessoaFisica`). Exceções conhecidas: `fiscais.pessoaFisicaCpf` ← `pessoa_fisica_CPF`; `pessoas_fisicas.cpf` ← `CPF`; `prestadores_servicos.cnpj` ← `CNPJ`; `users.passwordHash` ← nenhuma (`password` do legado é `ignorar`).
- **Conferência antes de gravar**: para cada tabela do mapa presente no dump, toda coluna de origem não opcional precisa existir no `CREATE TABLE`; faltou → erro fatal listando `banco.tabela.coluna` esperadas e as colunas que o dump tem, **nada é gravado** (nem em simulação segue adiante). Colunas do dump que o mapa não usa são listadas como informação no relatório (`colunasIgnoradas`), para revisão humana. Tabela obrigatória ausente (`contratos.contratos`) → fatal; tabela opcional ausente (ex.: `global.pessoas`) → aviso.
- Assim, quando o dump real chegar, a primeira simulação diz exatamente onde o mapa (derivado do modelo da RNC) diverge do esquema real; o ajuste é editar `mapa.ts` e o teste do mapa.

### D4. Ordem de carga e chaves de idempotência

| # | Destino | Origem | Chave de idempotência | Observações |
|---|---|---|---|---|
| 1 | `diretorias` | `global.diretorias` | `id` do legado preservado | |
| 2 | `departamentos` | `global.departamentos` | `id` preservado (`Departamento.id = Contrato.departamento_id`, `docs/legado/relatorios.md`) | `diretoriaId` sem diretoria → rejeitado |
| 3 | `pessoas_fisicas` | `global.pessoas_fisicas` | `cpf` (022 › D8) | sem CPF → não carregada (contagem "sem CPF"); duplicadas → vale `DtExcluido` nulo e maior `IdPessoaFisica`, as outras vão para avisos |
| 4 | `prestadores_servicos` | `global.prestadores_servicos` | `cnpj` (022 › D3) | sem CNPJ → não carregado (contagem); `id` do destino nunca muda numa recarga |
| 5 | `pessoas` | `global.pessoas` (opcional) | `id` preservado | |
| 6 | `tipo_contrato`, `modalidades`, `situacao_contratual`, `status`, `fases` | `contratos.*` | `id` preservado | `tipo_contrato.prestacaoContas = "S"` para ids 3–11 e 13 (021); `indicativoMetaRisco` 1/0 → `S`/`N` |
| 7 | `groups`, `groups_users` | `contratos.groups`, `contratos.groups_users` | `id` preservado | referência da 023 |
| 8 | `users` (+ `user_perfis`) | `contratos.users` | `username` | ver D7; id novo ≠ id legado: mapa em memória `usuarioLegado → id` |
| 9 | `contratos` (originais) | `contratos.contratos` com `parent_id` nulo | `id` preservado | |
| 10 | `contratos` (aditivos) | `parent_id` não nulo, em ordem topológica | `id` preservado | pai ausente no dump e no destino → rejeitado "aditivo sem contrato original" |
| 11 | `contrato_status` | `contratos.contrato_status` | `id` preservado | `status_id` obrigatório (`RK-a7017eb6c42d`, `RK-067d06861847`): nulo ou inexistente → rejeitado; `usuarioId` traduzido |
| 12 | `fiscais` | `contratos.fiscais` | `id` preservado | `pessoa_fisica_CPF` → `cpf`; `suplente`, `presidente` → `simNao` |
| 13 | `pagamentos` | `contratos.pagamentos` | `id` preservado | `valor`, `valor_glosa` → `dinheiro`; `competencia` obrigatória (`RK-774f44ed6df9`) |
| 14 | `pagamento_arquivos` | `contratos.pagamento_arquivos` | `id` preservado | `arquivo` obrigatório (`RK-77287deac605`) → `anexo` |
| 15 | `historicos` | `contratos.historicos` | `id` preservado | `usuarioId` traduzido (nulo se não achar) |
| 16 | `prestacao_contas` | `contratos.prestacao_contas` | `id` preservado | `atendido` 0/1 → `N`/`S` (021); `userId` traduzido (D7) |
| 17 | `penalidades` | `contratos.penalidades` | `id` preservado | `arquivo` → `anexo`; `userId` traduzido (D7) |
| 18 | `anexos_fiscais` | `contratos.anexos_fiscais` | `id` preservado | `anexo` obrigatório (`RK-0e70b6c81ee9`/`RK-9da08201400b`) |
| 19 | `anexos_publicacao` | `contratos.anexos_publicacao` | `id` preservado | `anexo` opcional |

- Linhas filhas (11–19) com `contrato_id` que não existe no destino → rejeitadas "contrato inexistente".
- **Upsert**: chave encontrada → compara campo a campo; igual → `inalterado`; diferente → `atualizado` (o legado vence; só faz sentido antes da virada, ver D10); não encontrada → `inserido`. Nada é apagado no destino; chaves do destino ausentes no dump vão para `existentesForaDoDump` no relatório.
- **Ids preservados e autoincremento**: o SQLite (`AUTOINCREMENT` gerado pelo Prisma) atualiza `sqlite_sequence` com o maior id inserido; o teste confere que o próximo registro criado pelo app recebe id maior que o maior do legado.
- **Uma transação** (`prisma.$transaction(fn, { timeout: 30 min })`) para a carga inteira: ou tudo entra, ou nada.

### D5. Conversões (`src/lib/migracao/conversoes.ts`)

| Conversor | Entrada (texto do dump) | Saída | Inválido |
|---|---|---|---|
| `dinheiro` | `FLOAT` como texto (`1234.565`, `1.5e6`, `-0.1`) | `Prisma.Decimal` arredondado a 2 casas com `ROUND_HALF_UP` | texto não numérico → rejeita a linha |
| `data` | `AAAA-MM-DD` | `Date` meia-noite UTC (mesma convenção de `parseDate`, `src/lib/format.ts`) | `0000-00-00`, data impossível → `null` se a coluna aceita, senão rejeita |
| `dataHora` | `AAAA-MM-DD HH:MM:SS` | `Date` interpretada em `America/Sao_Paulo` | idem |
| `cpf` / `cnpj` | texto ou número | só dígitos, zeros à esquerda até 11/14 (022 › D1) | mais de 11/14 dígitos → rejeita a linha; DV inválido → aviso |
| `simNao` | `1`, `0`, `S`, `N`, `s`, `n`, `''`, `NULL` | `"S"`/`"N"` | outro valor → rejeita |
| `zeroUm` | idem | `1`/`0` (Int) ou `"1"`/`"0"` (String, `prestacaoRealizada`) | outro valor → rejeita |
| `texto` | texto | texto sem alteração (inclusive acima dos limites da 020 — vira aviso) | — |

- **Colunas de indicador**: `simNao` → `tipo_contrato.gerenciamento`, `tipo_contrato.indicativoMetaRisco`, `fiscais.suplente`, `fiscais.presidente`, `prestacao_contas.atendido` (colunas `String` "S"/"N" do app); `zeroUm` → `contratos.naPresidencia` (Int, 020), `contrato_status.atendido` (Int), `contratos.prestacaoRealizada` (String "1"/"0", 021).
- **Dinheiro sem ponto flutuante**: o valor nunca passa por `Number`/`parseFloat`; o texto do dump vai direto para `new Prisma.Decimal(texto)` e depois `.toDecimalPlaces(2, ROUND_HALF_UP)`. Sempre que o valor gravado difere do texto de origem (ex.: `1234.565` → `1234.57`, `0.1000000015` → `0.10`), o relatório registra `{ tabela, id, coluna, origem, gravado }` em `arredondamentos`.
- **`valorInicial`**: copiado como está, inclusive nulo. A regra `RK-c3fbde6dbf4a` (`valorInicial = valorTotal` no original) vale na gravação pelo app, não na carga: o relatório "Acerto de valor" do legado existe justamente para os originais com `valor_inicial IS NULL` (`docs/legado/relatorios.md`), e preencher na carga apagaria essa pendência. Os originais com `valorInicial` nulo são contados no relatório.
- **Prestador**: `prestador_servico_id` (CNPJ) → `prestadores_servicos.id` pelo mapa `cnpj → id` carregado no passo 4; não achou → `prestadorServicoId = null`, linha em `migracao_pendencias` (`origem='025'`, `tabela='contratos'`, `campo='prestadorServicoId'`, `valorAntigo=<CNPJ>`, `motivo='CNPJ sem fornecedor'`) e erro de checagem no relatório (022 › D8). O contrato não é rejeitado.
- **Gestor/suplente/fiscal**: CPF gravado mesmo sem pessoa correspondente (022 › D1); aviso "CPF sem pessoa física" no relatório.

### D6. Anexos

- **Como os arquivos entram**: o operador copia a(s) pasta(s) de anexos do servidor antigo para o servidor novo (`rsync -a` ou mídia), em `./import/anexos/` (montado em `/import/anexos`), e passa `--anexos /import/anexos`. A estrutura interna não importa.
- **Localização**: o carregador indexa recursivamente a pasta por **nome de arquivo** (basename, comparação sem diferença de maiúsculas). O valor da coluna do legado (`contratos.anexo`, `contratos.projeto_basico`, `anexos_fiscais.anexo`, `anexos_publicacao.anexo`, `penalidades.arquivo`, `pagamento_arquivos.arquivo`) é reduzido ao basename e procurado no índice. Dois arquivos diferentes com o mesmo nome (SHA-256 distintos) → ambíguo.
- **Verificação e gravação**: o arquivo é lido, conferido com a assinatura `%PDF-` e gravado por `savePdf()` (diretiva do autor; aplica também `UPLOAD_MAX_MB` — para PDFs grandes do legado o operador aumenta `UPLOAD_MAX_MB` só na execução da carga). A coluna recebe o nome gerado (`<uuid>.pdf`).
- **Idempotência dos arquivos**: `migracao_arquivos` guarda `(caminhoLegado único, sha256, nomeGravado)`. Mesmo arquivo (mesmo SHA-256) numa nova execução → reutiliza `nomeGravado`, sem copiar de novo; SHA-256 diferente → grava de novo e atualiza.
- **Falhas** (não abortam a carga): arquivo não encontrado, ambíguo, não é PDF ou acima do limite → coluna opcional fica `null` e o relatório lista `{ tabela, id, coluna, valorLegado, motivo }`; coluna obrigatória (`anexos_fiscais.anexo`, `pagamento_arquivos.arquivo`) → linha rejeitada com o mesmo motivo.
- **Sem `--anexos`**: nenhuma cópia; colunas de anexo opcionais `null`, obrigatórias rejeitadas, tudo listado como "anexo não importado (sem --anexos)". Uma nova execução com `--anexos` completa (idempotente).
- **Simulação**: verifica existência, ambiguidade, assinatura e tamanho, mas não grava arquivo.
- Se a transação do banco falhar, os arquivos gravados nesta execução são apagados (registro de arquivos da requisição da 024, ou lista local equivalente).

### D7. Usuários e perfis

- `contratos.users` → `users` por `username`. Usuário novo: `inativo = 1`, `senhaRedefinir = true`, `passwordHash = hash bcrypt de 32 bytes aleatórios descartados` (a coluna é obrigatória; ninguém conhece a senha). A coluna `password` do legado é **descartada no parser** (conversor `ignorar`): nunca vai para memória do relatório, log, `migracao_pendencias` ou banco.
- Usuário já existente no destino com o mesmo `username`: não muda senha, `inativo` nem `senhaRedefinir`; só acrescenta perfis que faltam e passa a ser o alvo do mapa `usuarioLegado → id`.
- Campos copiados: `username`, `created`, `modified`, `pessoaId` (se a pessoa existir), `superuser`, `ultimoLogin`. O `inativo` do legado vai para o relatório (`usuariosInativosNoLegado`), porque todo migrado entra inativo.
- **Perfis**: `perfisDoLegado(nomes dos grupos do usuário em groups_users × groups)` da 023, mais `ADMINISTRADOR` se `superuser = 1`, senão `CONSULTA` quando vazio — a mesma regra da migração de dados da 023. Grupo sem mapeamento → listado em `gruposSemMapeamento`.
- **Autoria**: colunas obrigatórias de autoria (`prestacao_contas.userId`, `penalidades.userId`) cujo usuário do legado não existe no dump → atribuídas a um usuário técnico `legado.desconhecido` (criado inativo, `senhaRedefinir = true`, perfil `CONSULTA`), contadas no relatório; colunas opcionais (`historicos.usuarioId`, `contrato_status.usuarioId`) → `null` com aviso.
- **Ativação**: requisito novo em `users` — o Administrador (perfil da 023) abre `/users/[id]/senha`, informa senha e confirmação (`password`/`passwordconfirm`, mesmas regras de 005), e o servidor grava o hash, `senhaRedefinir = false` e `inativo = 0`. `src/lib/auth/login.ts` recusa login com `senhaRedefinir = true` com a mensagem genérica.

### D8. Relatório de conferência (`src/lib/migracao/relatorio.ts`)

- Arquivo `data/migracao/relatorio-<AAAAMMDD-HHMMSS>[-simulacao].json` (ou `--relatorio`), cópia em `migracao_execucoes.relatorio`, e resumo em tabela no terminal.
- Conteúdo:
  - `origem`: arquivos, SHA-256 de cada um, bancos e tabelas encontrados, `colunasIgnoradas`.
  - `tabelas[]`: `{ destino, origem, lidas, inseridas, atualizadas, inalteradas, rejeitadas, naoCarregadas }`, com a invariante `lidas = inseridas + atualizadas + inalteradas + rejeitadas + naoCarregadas`.
  - `somatorios[]`: para `contratos.valorTotal`, `contratos.valorInicial`, `contratos.valorMensal`, `pagamentos.valor`, `pagamentos.valorGlosa` — `origem` (soma exata em `Decimal` do texto do dump, todas as linhas lidas), `origemArredondada` (soma dos valores arredondados das linhas carregadas), `destino` (soma lida do banco depois da gravação, só ids do dump) e `diferenca = origemArredondada − destino` (tem de ser `0.00`).
  - `arredondamentos[]`, `rejeitados[]` (`{ tabela, idLegado, motivo }`), `avisos[]` (`{ tipo, tabela, idLegado, detalhe }`, tipos: `cpf_sem_pessoa`, `cnpj_sem_fornecedor`, `dv_invalido`, `cpf_duplicado`, `anexo_ausente`, `anexo_invalido`, `anexo_ambiguo`, `texto_acima_do_limite`, `autor_desconhecido`, `pendencia_cadastro`), `existentesForaDoDump[]`, `usuarios` (criados, existentes, `gruposSemMapeamento`, `usuariosInativosNoLegado`, perfis atribuídos por perfil), `contratosSemValorInicial`.
- **Pendências de cadastro**: contratos carregados sem um campo que o formulário exige recebem aviso `pendencia_cadastro` com a chave da regra: tipo (`RK-79134600b4be`), processo (`RK-776d8b62d6df`), número (`RK-04fd1cbfc346`), início (`RK-6b2806cfff8d`), vencimento (`RK-9d6599f5897d`), unidade gestora (`RK-a0660a4fb262`), fornecedor (`RK-37f294a3dc8e`). Não são rejeitados: o contrato existe no legado e a regra vale na próxima edição pelo app.
- Nunca contém `password`, `passwordHash` ou qualquer valor de senha.

### D9. Simulação

- `--simular` executa exatamente a mesma carga dentro da transação e, no fim, lança um erro sentinela que desfaz tudo; o relatório é gerado antes do rollback, com os somatórios de destino lidos dentro da transação. Arquivos: só verificados. Registra `migracao_execucoes` com `simulacao = true` **fora** da transação desfeita.
- Nenhum backup é feito em simulação.

### D10. Proteções da carga real

- **Backup antes**: `VACUUM INTO 'data/backups/pre-migracao-<AAAAMMDD-HHMMSS>.db'` (nome compatível com a retenção da 026) antes de abrir a transação; falhou → aborta.
- **Banco com dados que não vieram da carga**: se não existe execução real concluída em `migracao_execucoes` e `contratos`, `pagamentos` ou `fiscais` têm linhas → aborta ("o banco já tem dados criados no app; a carga deve rodar antes da virada"). Depois da primeira carga real, recargas (dump mais novo antes da virada) são permitidas; o runbook diz que, após a virada, não se recarrega.
- **App em uso**: sessão criada nos últimos 5 minutos → aborta (D2).
- Ao final da carga real, roda o resolvedor de gestores da 022 (`scripts/resolver-cpf-gestores.mjs`) e anexa a saída ao relatório.

### D11. Modelo de dados (migração `025_migracao_legado`)

```prisma
model MigracaoExecucao {
  id           Int       @id @default(autoincrement())
  iniciadoEm   DateTime  @default(now())
  concluidoEm  DateTime?
  simulacao    Boolean
  situacao     String    // "em_andamento" | "concluida" | "concluida_com_rejeicoes" | "abortada"
  origemSha256 String    // SHA-256 dos arquivos de origem, concatenados em ordem
  relatorio    String?   // JSON do relatório (D8)
  @@map("migracao_execucoes")
}

model MigracaoArquivo {
  id            Int      @id @default(autoincrement())
  caminhoLegado String   @unique // basename normalizado do valor da coluna do legado
  sha256        String
  nomeGravado   String   // nome gerado por savePdf()
  tamanho       Int
  criadoEm      DateTime @default(now())
  @@map("migracao_arquivos")
}
```

E em `User`: `senhaRedefinir Boolean @default(false)` — fora do schema `zod` de escrita de `/api/users` e do `serialize` (não é segredo, mas não é editável).

### D12. Testes com dump sintético

- `tests/helpers/dump-sintetico.ts` gera, dentro do teste, `contratos.sql` e `global.sql` no formato do `mysqldump` (com `USE`, `CREATE TABLE`, `LOCK TABLES`, *extended insert*, strings com `\'`, `\\` e `\n`, `NULL`, `0000-00-00`), com uns 3 a 10 registros por tabela, incluindo: um aditivo listado antes do original, um aditivo órfão, um CNPJ com máscara, um CPF numérico sem zero à esquerda, CPF duplicado no `global`, valores `1234.565` e `0.1000000015`, um usuário em `ContratoCGCL` e outro em grupo desconhecido, uma penalidade de autor inexistente, e uma pasta temporária de anexos com um PDF válido, um PNG renomeado para `.pdf` e um nome referenciado que não existe.
- Cada execução usa o banco de teste próprio do Vitest (`vitest.config.ts`) e `UPLOAD_DIR` temporário.

## Risks / Trade-offs

- [Mapa derivado do modelo da RNC diverge do esquema real] → conferência automática contra o `CREATE TABLE` (D3) aborta antes de gravar e lista as diferenças.
- [`FLOAT` do MySQL tem ~7 dígitos significativos: valores acima de ~R$ 100.000,00 podem já estar sem centavos exatos no legado] → a carga não recupera o que o legado perdeu; o relatório mostra origem × gravado e os somatórios para conferência com o financeiro.
- [Parser próprio de SQL] → escopo restrito à saída do `mysqldump` (não é um parser SQL geral); testes com todos os escapes; arquivo não reconhecido aborta.
- [Transação única longa no SQLite] → carga real com o app parado (D2); dimensão do legado pequena (`docs/levantamento.md`: escopo funcional pequeno).
- [Recarga depois da virada sobrescreveria edições feitas no app] → guarda de D10 só barra a primeira carga; após a virada o procedimento é não recarregar (runbook da 026).
- [Dados pessoais do `global.pessoas_fisicas` (~59 colunas, filiação, endereço)] → carregados como o modelo atual pede; minimização é Open Question.
- [Usuários migrados não entram até o Administrador agir] → é a regra pedida; o relatório lista quem precisa de senha.

## Open Questions

- **Esquema real**: nomes exatos das colunas do banco `global` (PascalCase confirmado só nas citadas em Context) e das chaves primárias de `global.departamentos`, `global.diretorias` e `global.prestadores_servicos`; e a coluna de `departamentos` que liga à diretoria. A primeira simulação com o dump real responde (D3).
- **Codificação do dump**: os bancos do legado (PHP até 5.6) estão em `latin1` ou `utf8`? Define o padrão de `--encoding`.
- **Pasta dos anexos no servidor antigo** e se `contratos.anexo` guarda só o nome ou um caminho; se houver nomes repetidos em pastas diferentes, o casamento por basename vira ambíguo e será preciso casar pelo caminho relativo.
- **Formato de `suplente`/`presidente` (`fiscais`) e `atendido`** no legado: `0/1` ou `S/N`? O conversor aceita os dois; confirmar no dump.
- **Minimização de dados pessoais**: carregar todo o `global.pessoas_fisicas` ou só as pessoas referenciadas (gestores, suplentes, fiscais) mais as ativas? Depende da política de LGPD do DETRAN-RJ.
- **Usuário técnico `legado.desconhecido`** para autoria de registros cujo usuário sumiu do legado: aceitável, ou o autor prefere rejeitar essas linhas?
- **`users.pessoa_id` do legado** aponta para `pessoas` ou para `pessoas_fisicas`? (023 deixou `pessoaId` sem relação confirmada.)
- **MCP da RNC**: com o MCP conectado, `getSourceFile` nos models do legado pode confirmar os nomes de coluna antes do dump chegar; não foi feito nesta proposta.
