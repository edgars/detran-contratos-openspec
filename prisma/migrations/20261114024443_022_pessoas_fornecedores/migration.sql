-- AlterTable
ALTER TABLE "pessoas_fisicas" ADD COLUMN "cpf" TEXT;

-- AlterTable
ALTER TABLE "prestadores_servicos" ADD COLUMN "cnpj" TEXT;

-- CreateTable
CREATE TABLE "migracao_pendencias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origem" TEXT NOT NULL,
    "tabela" TEXT NOT NULL,
    "registroId" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAntigo" TEXT,
    "motivo" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" DATETIME
);

-- CreateIndex
CREATE INDEX "migracao_pendencias_origem_resolvidoEm_idx" ON "migracao_pendencias"("origem", "resolvidoEm");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_fisicas_cpf_key" ON "pessoas_fisicas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "prestadores_servicos_cnpj_key" ON "prestadores_servicos"("cnpj");


-- ---------------------------------------------------------------------------------------------
-- Dados (022-pessoas-fornecedores, design.md D7). Escrito à mão; roda na mesma migração.
-- ---------------------------------------------------------------------------------------------

-- D7.2 — CPF dos fiscais passa a ser gravado só com dígitos (o formato antigo era ###.###.###-##).
UPDATE "fiscais" SET "pessoaFisicaCpf" = replace(replace("pessoaFisicaCpf", '.', ''), '-', '');

-- D7.3 — Gestor e suplente gravados como idPessoaFisica (ou qualquer valor que não é um CPF
-- existente em pessoas_fisicas) vão para migracao_pendencias com o valor antigo, e o campo fica nulo.
-- `pessoas_fisicas.cpf` acabou de nascer vazio: o resolvedor (scripts/resolver-cpf-gestores.mjs)
-- troca o valor antigo pelo CPF depois da carga.
INSERT INTO "migracao_pendencias" ("origem", "tabela", "registroId", "campo", "valorAntigo", "motivo")
SELECT '022', 'contratos', c."id", 'pessoaFisicaId', c."pessoaFisicaId", 'idPessoaFisica aguardando CPF'
FROM "contratos" c
WHERE c."pessoaFisicaId" IS NOT NULL AND trim(c."pessoaFisicaId") <> ''
  AND NOT EXISTS (SELECT 1 FROM "pessoas_fisicas" p WHERE p."cpf" = c."pessoaFisicaId");

INSERT INTO "migracao_pendencias" ("origem", "tabela", "registroId", "campo", "valorAntigo", "motivo")
SELECT '022', 'contratos', c."id", 'suplenteId', c."suplenteId", 'idPessoaFisica aguardando CPF'
FROM "contratos" c
WHERE c."suplenteId" IS NOT NULL AND trim(c."suplenteId") <> ''
  AND NOT EXISTS (SELECT 1 FROM "pessoas_fisicas" p WHERE p."cpf" = c."suplenteId");

UPDATE "contratos" SET "pessoaFisicaId" = NULL
WHERE "pessoaFisicaId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "pessoas_fisicas" p WHERE p."cpf" = "contratos"."pessoaFisicaId");

UPDATE "contratos" SET "suplenteId" = NULL
WHERE "suplenteId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "pessoas_fisicas" p WHERE p."cpf" = "contratos"."suplenteId");
