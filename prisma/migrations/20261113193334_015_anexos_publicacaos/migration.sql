-- CreateTable
CREATE TABLE "anexos_publicacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "anexo" TEXT,
    "contratoId" INTEGER NOT NULL,
    "dataPublicacao" DATETIME NOT NULL
);
