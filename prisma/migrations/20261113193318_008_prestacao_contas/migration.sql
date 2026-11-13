-- CreateTable
CREATE TABLE "prestacao_contas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descricao" TEXT,
    "atendido" TEXT,
    "dataInclusao" DATETIME,
    "faseId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "contratoId" INTEGER NOT NULL
);
