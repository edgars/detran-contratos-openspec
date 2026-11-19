-- CreateTable
CREATE TABLE "penalidades" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dataRegistro" DATETIME NOT NULL,
    "arquivo" TEXT,
    "contratoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL
);
