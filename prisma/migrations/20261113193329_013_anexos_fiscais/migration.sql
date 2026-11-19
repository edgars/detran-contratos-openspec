-- CreateTable
CREATE TABLE "anexos_fiscais" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "anexo" TEXT NOT NULL,
    "dataRegistro" DATETIME NOT NULL,
    "contratoId" INTEGER NOT NULL
);
