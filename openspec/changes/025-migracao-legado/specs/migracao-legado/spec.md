# Spec Delta

## Purpose

Migração dos dados do legado: o sistema SHALL carregar o dump MySQL dos bancos `contratos` e `global` e os PDFs do servidor antigo de forma idempotente, conferida e reversível (simulação e backup prévio), preservando as chaves do legado (ids, CPF, CNPJ), convertendo dinheiro para `Decimal` com arredondamento registrado, criando usuários inativos sem senha e emitindo um relatório de conferência.

## ADDED Requirements

### Requirement: Entrada em dump do mysqldump
O comando `npm run migrar` SHALL aceitar um ou mais arquivos `.sql` gerados pelo `mysqldump` (`--origem`, um por banco), lendo `CREATE TABLE` e `INSERT … VALUES` (inclusive com várias linhas por `INSERT`), com os escapes de string do MySQL, `NULL` e valores hexadecimais. Todo valor SHALL ser lido como texto ou nulo, nunca como número de ponto flutuante. Arquivo sem `CREATE TABLE` reconhecível SHALL abortar a carga sem gravar.

#### Scenario: Dump com várias linhas por INSERT
- **GIVEN** um dump sintético com `INSERT INTO \`contratos\` VALUES (1,…),(2,…),(3,…);` e um objeto contendo `O\'Brien\nRJ`
- **WHEN** o operador roda `npm run migrar -- --origem contratos.sql --origem global.sql --simular`
- **THEN** o relatório conta 3 contratos lidos e o objeto do contrato é `O'Brien` seguido de quebra de linha e `RJ`

#### Scenario: Arquivo que não é dump
- **WHEN** o operador passa um PDF ou um CSV em `--origem`
- **THEN** o comando termina com código `1` e a mensagem "não parece um dump do mysqldump", e nenhuma tabela é alterada

### Requirement: Mapa de colunas conferido antes de gravar
Antes de gravar qualquer linha, o carregador SHALL conferir cada coluna de origem exigida pelo mapa (`src/lib/migracao/mapa.ts`) contra o `CREATE TABLE` do dump. Coluna exigida ausente, ou tabela obrigatória ausente, SHALL abortar a carga listando `banco.tabela.coluna` esperadas e as colunas encontradas. Colunas do dump não usadas pelo mapa SHALL ser listadas no relatório.

#### Scenario: Coluna renomeada no dump real
- **GIVEN** um dump em que `contratos.contratos` tem `dt_termino` no lugar de `data_termino`
- **WHEN** o operador roda a carga, com ou sem `--simular`
- **THEN** o comando termina com código `1` citando `contratos.contratos.data_termino` ausente e mostrando `dt_termino` entre as colunas encontradas, e nada é gravado

#### Scenario: Coluna a mais no dump
- **GIVEN** um dump com uma coluna `observacao_interna` em `contratos.contratos` que o mapa não usa
- **WHEN** a simulação roda
- **THEN** a carga segue e o relatório lista `contratos.contratos.observacao_interna` em `colunasIgnoradas`

### Requirement: Referências carregadas antes dos contratos
O carregador SHALL gravar, nesta ordem: diretorias, departamentos, pessoas físicas, prestadores de serviço, pessoas, tabelas auxiliares (tipos de contrato, modalidades, situações, status, fases), grupos e usuários; depois contratos originais, aditivos e, por fim, andamentos, fiscais, pagamentos, arquivos de pagamento, históricos, prestação de contas, penalidades, anexos fiscais e anexos de publicação. Linha filha cujo contrato não existe SHALL ser rejeitada com o motivo "contrato inexistente".

#### Scenario: Pagamento de contrato inexistente
- **GIVEN** um pagamento com `contrato_id = 999` e nenhum contrato 999 no dump
- **WHEN** a carga roda
- **THEN** o pagamento aparece em `rejeitados` com o motivo "contrato inexistente" e os demais pagamentos são gravados

### Requirement: Pessoas e fornecedores pelas chaves do legado
O carregador SHALL gravar `pessoas_fisicas.cpf` e `prestadores_servicos.cnpj` só com dígitos e zeros à esquerda (11 e 14), por upsert nessas chaves, sem nunca apagar e recriar um fornecedor. Gestor, suplente e fiscal SHALL receber o CPF do legado mesmo sem pessoa correspondente (aviso `cpf_sem_pessoa`). O CNPJ de `contratos.prestador_servico_id` SHALL ser traduzido para `prestadores_servicos.id`; sem fornecedor, o campo fica nulo e o relatório registra erro de checagem.

#### Scenario: CPF numérico sem zero à esquerda
- **GIVEN** `global.pessoas_fisicas.CPF = 1234567890` e um contrato com `pessoa_fisica_id = '01234567890'`
- **WHEN** a carga roda
- **THEN** a pessoa é gravada com `cpf = "01234567890"` e o contrato tem `pessoaFisicaId = "01234567890"`

#### Scenario: CNPJ com máscara
- **GIVEN** um fornecedor com `CNPJ = '12.345.678/0001-90'` e um contrato com `prestador_servico_id = '12345678000190'`
- **WHEN** a carga roda
- **THEN** o contrato aponta para o `id` desse fornecedor

#### Scenario: CNPJ sem fornecedor
- **GIVEN** um contrato com um CNPJ que não existe em `global.prestadores_servicos`
- **WHEN** a carga roda
- **THEN** o contrato é gravado com `prestadorServicoId` nulo, uma linha é criada em `migracao_pendencias` com o CNPJ, e o relatório lista o erro `cnpj_sem_fornecedor`

#### Scenario: CPF duplicado no global
- **GIVEN** duas linhas de `global.pessoas_fisicas` com o mesmo CPF, uma com `DtExcluido` preenchido
- **WHEN** a carga roda
- **THEN** é gravada a linha com `DtExcluido` nulo e a outra aparece em avisos como `cpf_duplicado`

### Requirement: Aditivos ligados ao contrato original
O carregador SHALL gravar contratos originais (`parent_id` nulo) antes dos aditivos e os aditivos em ordem de dependência, preservando o `id` do legado e o `parentId`. Aditivo cujo original não existe no dump nem no destino SHALL ser rejeitado com o motivo "aditivo sem contrato original". O `valorInicial` SHALL ser copiado como está, sem aplicar `RK-c3fbde6dbf4a`, e os originais com `valorInicial` nulo SHALL ser contados no relatório.

#### Scenario: Aditivo antes do original no dump
- **GIVEN** um dump em que o aditivo 20 (`parent_id = 10`) aparece antes do contrato 10
- **WHEN** a carga roda
- **THEN** os dois são gravados e o contrato 20 tem `parentId = 10`

#### Scenario: Aditivo órfão
- **GIVEN** um aditivo com `parent_id = 77` e nenhum contrato 77
- **WHEN** a carga roda
- **THEN** o aditivo aparece em `rejeitados` com "aditivo sem contrato original"

#### Scenario: Original sem valor inicial
- **GIVEN** um contrato original com `valor_inicial` nulo e `valor_total = 1000.00`
- **WHEN** a carga roda
- **THEN** o contrato é gravado com `valorInicial` nulo e conta em `contratosSemValorInicial`

### Requirement: Dinheiro de FLOAT para Decimal com arredondamento registrado
Os valores `valorTotal`, `valorInicial`, `valorMensal`, `valor` e `valorGlosa` SHALL ser convertidos do texto do dump para `Decimal` com 2 casas, arredondando meio para cima, sem passar por número de ponto flutuante. Todo valor gravado diferente do texto de origem SHALL ser registrado em `arredondamentos` com tabela, id, coluna, valor de origem e valor gravado.

#### Scenario: Valor com três casas
- **GIVEN** um pagamento com `valor = 1234.565`
- **WHEN** a carga roda
- **THEN** o pagamento é gravado com `valor = 1234.57` e `arredondamentos` tem `{ tabela: "pagamentos", coluna: "valor", origem: "1234.565", gravado: "1234.57" }`

#### Scenario: Resíduo de FLOAT
- **GIVEN** um contrato com `valor_total = 0.1000000015`
- **WHEN** a carga roda
- **THEN** o contrato é gravado com `valorTotal = 0.10` e o arredondamento é registrado

#### Scenario: Valor exato
- **GIVEN** um contrato com `valor_mensal = 2500.5`
- **WHEN** a carga roda
- **THEN** o contrato é gravado com `valorMensal = 2500.50` e nada é registrado em `arredondamentos` para ele

### Requirement: Datas e indicadores convertidos
Datas `AAAA-MM-DD` SHALL ser gravadas à meia-noite UTC; `0000-00-00` ou data impossível SHALL virar nulo quando a coluna aceita e rejeitar a linha quando é obrigatória. Indicadores do legado SHALL ser convertidos para o formato do app: `S`/`N` nas colunas texto de sim/não e `1`/`0` nas inteiras e em `prestacaoRealizada` (lista em design.md › D5). Os tipos de contrato 3 a 11 e 13 SHALL receber `prestacaoContas = "S"`.

#### Scenario: Data zerada em coluna opcional
- **GIVEN** um contrato com `data_inclusao = '0000-00-00'`
- **WHEN** a carga roda
- **THEN** o contrato é gravado com `dataInclusao` nulo

#### Scenario: Data zerada em coluna obrigatória
- **GIVEN** um pagamento com `competencia = '0000-00-00'`
- **WHEN** a carga roda
- **THEN** o pagamento é rejeitado com o motivo "competencia inválida" (`RK-774f44ed6df9`)

#### Scenario: Indicador de prestação de contas
- **GIVEN** um registro de `prestacao_contas` com `atendido = 1` e um contrato com `prestacao_realizada = 1`
- **WHEN** a carga roda
- **THEN** o registro tem `atendido = "S"` e o contrato `prestacaoRealizada = "1"`

### Requirement: Anexos importados da pasta do servidor antigo
Com `--anexos <pasta>`, o carregador SHALL localizar cada arquivo referenciado pelo nome (sem diferenciar maiúsculas), conferir a assinatura `%PDF-` e gravá-lo por `savePdf()`, guardando na coluna o nome gerado. Arquivo ausente, ambíguo, que não é PDF ou acima do limite SHALL deixar a coluna opcional nula e rejeitar a linha quando a coluna é obrigatória, sempre com o motivo no relatório.

#### Scenario: PDF válido
- **GIVEN** `contratos.anexo = 'uploads/contratos/ct_10.pdf'` e o arquivo `ct_10.pdf` com conteúdo `%PDF-` em alguma subpasta de `--anexos`
- **WHEN** a carga real roda
- **THEN** o contrato tem `anexo` no formato `<uuid>.pdf` e um usuário logado com permissão baixa o arquivo em `/api/arquivos/<nome>` com o mesmo SHA-256 do original

#### Scenario: Imagem renomeada para .pdf
- **GIVEN** um anexo de publicação cujo arquivo é um PNG com extensão `.pdf`
- **WHEN** a carga roda
- **THEN** o anexo de publicação é gravado com `anexo` nulo e o relatório tem o aviso `anexo_invalido`

#### Scenario: Anexo fiscal sem arquivo
- **GIVEN** um registro de `anexos_fiscais` cujo arquivo não está na pasta
- **WHEN** a carga roda
- **THEN** o registro é rejeitado com o motivo "anexo não encontrado"

#### Scenario: Sem pasta de anexos
- **WHEN** a carga roda sem `--anexos`
- **THEN** nenhum arquivo é gravado, as colunas de anexo opcionais ficam nulas e o relatório lista cada uma como "anexo não importado (sem --anexos)"

### Requirement: Usuários migrados inativos e sem senha
O carregador SHALL criar cada usuário do legado com `inativo = 1`, `senhaRedefinir = true` e um hash de senha aleatória descartada. A senha do legado SHALL NOT ser lida para o banco, o relatório, o log ou `migracao_pendencias`. Usuário com o mesmo `username` já existente SHALL manter senha e situação. Um usuário migrado SHALL NOT conseguir entrar até o Administrador definir a senha.

#### Scenario: Login de usuário migrado
- **GIVEN** o usuário `joao` carregado do legado com a senha `segredo123` no dump
- **WHEN** alguém tenta entrar como `joao` com `segredo123`
- **THEN** o login é recusado com a mensagem genérica de falha

#### Scenario: Senha fora do relatório
- **GIVEN** um dump em que `users.password` contém `HASHLEGADO123`
- **WHEN** a carga roda
- **THEN** nem o relatório JSON, nem a saída do terminal, nem nenhuma tabela do banco contém `HASHLEGADO123`

#### Scenario: Usuário já existente
- **GIVEN** o usuário `admin` já existente e ativo no destino e um `admin` no dump
- **WHEN** a carga roda
- **THEN** `admin` continua ativo, com a mesma senha

### Requirement: Grupos do legado mapeados para perfis
O carregador SHALL atribuir perfis a cada usuário migrado com `perfisDoLegado()` da `023-perfis-acesso` sobre os grupos do usuário (`ContratoCGCL` → Administrador, `Gestor` e `PrestacaoConta` → Gestor de contrato, `Pagamentos` → Financeiro), acrescentar Administrador quando `superuser = 1` e dar Consulta a quem ficar sem perfil. Grupo sem mapeamento SHALL ser listado em `gruposSemMapeamento`.

#### Scenario: Usuário em dois grupos
- **GIVEN** `maria` nos grupos `Gestor` e `Pagamentos`
- **WHEN** a carga roda
- **THEN** `maria` tem os perfis Gestor de contrato e Financeiro

#### Scenario: Grupo desconhecido
- **GIVEN** `pedro` só no grupo `Auditoria`
- **WHEN** a carga roda
- **THEN** `pedro` tem o perfil Consulta e `Auditoria` aparece em `gruposSemMapeamento`

### Requirement: Autoria preservada
Colunas de autoria SHALL apontar para o usuário migrado correspondente ao usuário do legado. Quando o usuário do legado não existe no dump, colunas obrigatórias (`prestacao_contas.userId`, `penalidades.userId`) SHALL apontar para o usuário técnico inativo `legado.desconhecido` e colunas opcionais (`historicos.usuarioId`, `contrato_status.usuarioId`) SHALL ficar nulas, com aviso `autor_desconhecido`.

#### Scenario: Penalidade de autor removido
- **GIVEN** uma penalidade com `user_id = 55` e nenhum usuário 55 no dump
- **WHEN** a carga roda
- **THEN** a penalidade é gravada com o `userId` de `legado.desconhecido` e o relatório tem o aviso `autor_desconhecido`

### Requirement: Carga idempotente
Rodar a carga real de novo com o mesmo dump e a mesma pasta de anexos SHALL NOT inserir, alterar nem apagar nenhuma linha e SHALL NOT gravar novamente nenhum arquivo. Com um dump mais novo, linhas cuja chave já existe SHALL ser atualizadas; nenhuma linha do destino SHALL ser apagada, e as ausentes do dump SHALL ser listadas em `existentesForaDoDump`.

#### Scenario: Segunda execução igual
- **GIVEN** uma carga real concluída
- **WHEN** a mesma carga roda de novo com `--confirmar`
- **THEN** o relatório mostra `inseridas = 0` e `atualizadas = 0` em todas as tabelas, as contagens do banco e a pasta de anexos não mudam

#### Scenario: Dump mais novo
- **GIVEN** uma carga real concluída e um segundo dump em que o contrato 10 mudou de `objeto` e o contrato 11 sumiu
- **WHEN** a carga roda com o segundo dump
- **THEN** o contrato 10 é atualizado, o contrato 11 continua no banco e aparece em `existentesForaDoDump`

#### Scenario: Novo registro depois da carga
- **GIVEN** uma carga que gravou contratos com ids até 500
- **WHEN** o operador cria um contrato pelo app
- **THEN** o novo contrato recebe id maior que 500

### Requirement: Modo de simulação
Com `--simular`, o carregador SHALL executar todas as etapas e checagens, gerar o relatório completo e desfazer tudo ao final: nenhuma linha de dados SHALL ser gravada e nenhum arquivo SHALL ser copiado. A execução SHALL ficar registrada em `migracao_execucoes` com `simulacao = true`. Sem `--simular`, a carga SHALL exigir `--confirmar`.

#### Scenario: Simulação não grava
- **GIVEN** um banco vazio
- **WHEN** o operador roda a carga com `--simular`
- **THEN** o relatório mostra as linhas que seriam inseridas, as tabelas de dados continuam vazias e a pasta de anexos não muda

#### Scenario: Carga real sem confirmação
- **WHEN** o operador roda a carga sem `--simular` e sem `--confirmar`
- **THEN** o comando recusa com a instrução de simular antes, e nada é gravado

### Requirement: Proteções da carga real
Antes de gravar, a carga real SHALL fazer um backup do banco com `VACUUM INTO` em `data/backups/pre-migracao-<data-hora>.db` e SHALL abortar se o backup falhar, se o banco tiver contratos, pagamentos ou fiscais e nenhuma carga real anterior concluída, ou se houver sessão criada nos últimos 5 minutos. A carga inteira SHALL ser uma transação única.

#### Scenario: Banco com dados criados no app
- **GIVEN** um banco sem carga anterior e com um contrato criado pelo app
- **WHEN** a carga real roda
- **THEN** o comando termina com código `1` explicando que a carga deve rodar antes da virada, e nada é gravado

#### Scenario: Falha no meio da carga
- **GIVEN** um erro inesperado ao gravar os pagamentos
- **WHEN** a carga real roda
- **THEN** nenhuma tabela fica com dados parciais, os arquivos gravados na execução são apagados e o backup `pre-migracao-*` existe

### Requirement: Relatório de conferência
Toda execução SHALL gerar um relatório JSON e um resumo no terminal com: contagens por tabela (lidas, inseridas, atualizadas, inalteradas, rejeitadas, não carregadas, somando as lidas), somatórios de valores na origem, na origem arredondada e no destino com a diferença, arredondamentos, rejeitados com motivo e avisos. O código de saída SHALL ser `0` sem rejeições, `2` com rejeições e `1` quando abortada.

#### Scenario: Somatórios batem
- **GIVEN** um dump com 3 pagamentos de `100.005`, `200.10` e `0.333`
- **WHEN** a carga real roda
- **THEN** o relatório tem para `pagamentos.valor` origem `300.438`, origem arredondada `300.44`, destino `300.44` e diferença `0.00`

#### Scenario: Contagens fecham
- **WHEN** qualquer carga termina
- **THEN** em cada tabela do relatório `lidas` é igual à soma de inseridas, atualizadas, inalteradas, rejeitadas e não carregadas

#### Scenario: Execução com rejeições
- **GIVEN** um dump com um aditivo órfão
- **WHEN** a carga real termina
- **THEN** o código de saída é `2` e o aditivo aparece em `rejeitados` com o motivo

### Requirement: Pendências de cadastro sinalizadas
Contrato carregado sem um campo que o formulário exige SHALL ser gravado e SHALL gerar aviso `pendencia_cadastro` com a chave da regra: tipo (`RK-79134600b4be`), processo (`RK-776d8b62d6df`), número (`RK-04fd1cbfc346`), início (`RK-6b2806cfff8d`), vencimento (`RK-9d6599f5897d`), unidade gestora (`RK-a0660a4fb262`) e fornecedor (`RK-37f294a3dc8e`).

#### Scenario: Contrato sem número de processo
- **GIVEN** um contrato do legado com `numero_processo` nulo
- **WHEN** a carga roda
- **THEN** o contrato é gravado e o relatório tem o aviso `pendencia_cadastro` citando `RK-776d8b62d6df`
