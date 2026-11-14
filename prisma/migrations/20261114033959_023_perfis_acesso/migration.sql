-- 023-perfis-acesso: perfis de acesso por usuário (design.md › Modelo de dados).
-- `perfil` é texto com CHECK (sem enum do Prisma no SQLite); o catálogo é o de src/lib/auth/permissions.ts.

-- CreateTable
CREATE TABLE "user_perfis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "perfil" TEXT NOT NULL CHECK ("perfil" IN ('ADMINISTRADOR', 'GESTOR_CONTRATO', 'FISCAL', 'FINANCEIRO', 'CONSULTA')),
    CONSTRAINT "user_perfis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_perfis_userId_idx" ON "user_perfis"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_perfis_userId_perfil_key" ON "user_perfis"("userId", "perfil");

-- MIGRACAO DE DADOS (design.md › Seed e migração dos usuários atuais). Idempotente: INSERT OR IGNORE
-- sobre o índice único (userId, perfil); nada é removido. tests/perfis-migracao.test.ts roda este
-- trecho (a partir da linha acima) de novo sobre um banco de teste.

-- 1. Grupos do legado (groups_users × groups.name); mesmo mapeamento de src/lib/auth/perfis-legado.ts.
INSERT OR IGNORE INTO "user_perfis" ("userId", "perfil")
SELECT DISTINCT gu."userId",
       CASE g."name"
         WHEN 'ContratoCGCL' THEN 'ADMINISTRADOR'
         WHEN 'Gestor' THEN 'GESTOR_CONTRATO'
         WHEN 'PrestacaoConta' THEN 'GESTOR_CONTRATO'
         WHEN 'Pagamentos' THEN 'FINANCEIRO'
       END
FROM "groups_users" gu
JOIN "groups" g ON g."id" = gu."groupId"
JOIN "users" u ON u."id" = gu."userId"
WHERE g."name" IN ('ContratoCGCL', 'Gestor', 'PrestacaoConta', 'Pagamentos');

-- 2. superuser = 1 → Administrador.
INSERT OR IGNORE INTO "user_perfis" ("userId", "perfil")
SELECT "id", 'ADMINISTRADOR' FROM "users" WHERE "superuser" = 1;

-- 3. Quem continua sem perfil → Consulta (menor privilégio).
INSERT OR IGNORE INTO "user_perfis" ("userId", "perfil")
SELECT "id", 'CONSULTA' FROM "users"
WHERE NOT EXISTS (SELECT 1 FROM "user_perfis" p WHERE p."userId" = "users"."id");

-- 4. Nenhum Administrador: o usuário ativo de menor id recebe o perfil.
INSERT OR IGNORE INTO "user_perfis" ("userId", "perfil")
SELECT "id", 'ADMINISTRADOR' FROM "users"
WHERE ("inativo" IS NULL OR "inativo" = 0)
  AND NOT EXISTS (SELECT 1 FROM "user_perfis" WHERE "perfil" = 'ADMINISTRADOR')
ORDER BY "id"
LIMIT 1;
