-- CreateTable
CREATE TABLE "pagamentos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "competencia" DATETIME NOT NULL,
    "numeroProcesso" TEXT NOT NULL,
    "contratoId" INTEGER NOT NULL,
    "valor" DECIMAL,
    "empenho" TEXT,
    "notaFiscal" TEXT,
    "notaLiquidacao" TEXT,
    "ordemBancaria" TEXT,
    "glosa" TEXT,
    "valorGlosa" DECIMAL,
    "mes" TEXT,
    "ano" TEXT
);
