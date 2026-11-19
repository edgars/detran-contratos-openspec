-- CreateTable
CREATE TABLE "tipo_contrato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT,
    "gerenciamento" TEXT NOT NULL,
    "indicativoMetaRisco" TEXT NOT NULL DEFAULT 'N'
);
