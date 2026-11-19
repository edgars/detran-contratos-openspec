-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tipo_contrato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT,
    "gerenciamento" TEXT NOT NULL,
    "indicativoMetaRisco" TEXT NOT NULL DEFAULT 'N',
    "prestacaoContas" TEXT NOT NULL DEFAULT 'N',
    "contratoPrincipal" TEXT NOT NULL DEFAULT 'N'
);
INSERT INTO "new_tipo_contrato" ("gerenciamento", "id", "indicativoMetaRisco", "nome", "prestacaoContas") SELECT "gerenciamento", "id", "indicativoMetaRisco", "nome", "prestacaoContas" FROM "tipo_contrato";
DROP TABLE "tipo_contrato";
ALTER TABLE "new_tipo_contrato" RENAME TO "tipo_contrato";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
