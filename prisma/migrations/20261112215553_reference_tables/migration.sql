-- CreateTable
CREATE TABLE "diretorias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deDiretoria" TEXT NOT NULL,
    "codigo" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "pessoas_fisicas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPessoaFisica" INTEGER NOT NULL,
    "deNome" TEXT,
    "deEndereco" TEXT,
    "deBairro" TEXT,
    "deTelefone" TEXT,
    "deNomePai" TEXT,
    "deNomeMae" TEXT,
    "deNaturalidade" TEXT,
    "deUrlFoto" TEXT,
    "prestadorServico" TEXT,
    "cep" TEXT,
    "pseudonimo" TEXT,
    "nuExtraQuadro" TEXT,
    "nuRegistro" TEXT,
    "nuMatricula" TEXT,
    "identidadeFuncional" TEXT,
    "vinculo" INTEGER,
    "flTermoImpresso" TEXT,
    "flFuncionarioPublico" TEXT,
    "flConformidadeTermo" TEXT,
    "flEmitirCracha" TEXT,
    "flAprovado" TEXT,
    "flAposentado" INTEGER,
    "dtNascimento" DATETIME NOT NULL,
    "dtInclusaoTermo" DATETIME,
    "dtTermoRecebido" DATETIME,
    "dtTermoPreAprovado" DATETIME,
    "dtCracha" DATETIME,
    "dtCorregedoria" DATETIME,
    "dtInformatica" DATETIME,
    "dtExcluido" DATETIME,
    "dtUltimaAlteracaoTermo" DATETIME,
    "foto" TEXT,
    "municipioId" INTEGER,
    "cargoId" INTEGER,
    "tipoSanguineoId" INTEGER,
    "departamentoId" INTEGER,
    "lotacaoId" INTEGER,
    "lotacaoOrigemId" INTEGER,
    "ufId" TEXT,
    "orgaoExpedidorId" INTEGER,
    "origemExternaId" INTEGER,
    "nacionalidadeId" INTEGER,
    "guiaRemessaId" INTEGER,
    "guiaRemessaCrachaId" INTEGER,
    "usuarioCorregedoriaId" INTEGER,
    "usuarioDpId" INTEGER,
    "flAlteracao" INTEGER,
    "deObservacao" TEXT,
    "deSimbolo" TEXT,
    "dtPublicDoerj" DATETIME,
    "dtValidade" DATETIME,
    "dtNomeacao" DATETIME,
    "dtPosse" DATETIME,
    "dtExercicio" DATETIME,
    "flPublicadoDoerj" TEXT,
    "dtPublicDoerjN" DATETIME,
    "lotacaoCgpId" INTEGER
);

-- CreateTable
CREATE TABLE "pessoas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cpf" TEXT,
    "cnpj" TEXT
);

-- CreateTable
CREATE TABLE "prestadores_servicos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deRazaoSocial" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "groups_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "acoId" INTEGER
);

-- CreateTable
CREATE TABLE "pagamento_arquivos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "arquivo" TEXT NOT NULL,
    "pagamentoId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "created" DATETIME,
    "modified" DATETIME,
    "acoId" INTEGER,
    "descricao" TEXT
);
