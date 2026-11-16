-- 025-migracao-legado (design.md D11): histórico das execuções da carga, anexos importados e users.senhaRedefinir.
-- CreateTable
CREATE TABLE "migracao_execucoes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "iniciadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" DATETIME,
    "simulacao" BOOLEAN NOT NULL,
    "situacao" TEXT NOT NULL,
    "origemSha256" TEXT NOT NULL,
    "relatorio" TEXT
);

-- CreateTable
CREATE TABLE "migracao_arquivos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caminhoLegado" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "nomeGravado" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AlterTable (ADD COLUMN: não recria users, preserva sessions e user_perfis)
ALTER TABLE "users" ADD COLUMN "senhaRedefinir" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "migracao_arquivos_caminhoLegado_key" ON "migracao_arquivos"("caminhoLegado");
