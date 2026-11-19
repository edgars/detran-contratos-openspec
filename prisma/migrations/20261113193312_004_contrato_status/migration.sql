-- CreateTable
CREATE TABLE "contrato_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contratoId" INTEGER NOT NULL,
    "statusId" INTEGER NOT NULL,
    "dataInclusao" DATETIME,
    "descricao" TEXT,
    "usuarioId" INTEGER,
    "atendido" INTEGER,
    "aditivoId" INTEGER
);
