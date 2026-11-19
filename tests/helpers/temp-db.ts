import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const ROOT = resolve(__dirname, "../..");
const MIGRATIONS = join(ROOT, "prisma/migrations");

/** Nomes das pastas de migração em ordem (sem o migration_lock.toml). */
export function migrationNames() {
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/**
 * Banco SQLite temporário com uma cópia de `prisma/` (schema + migrações escolhidas), para testar
 * migrações de dados e scripts sem tocar no banco da suíte. `deploy(nomes)` aplica as migrações dadas.
 */
export function tempDb(prefix = "tmpdb-") {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const prismaDir = join(dir, "prisma");
  mkdirSync(join(prismaDir, "migrations"), { recursive: true });
  cpSync(join(ROOT, "prisma/schema.prisma"), join(prismaDir, "schema.prisma"));
  cpSync(join(MIGRATIONS, "migration_lock.toml"), join(prismaDir, "migrations/migration_lock.toml"));
  const file = join(dir, "db.sqlite");
  const url = `file:${file}`;
  const env = { ...process.env, DATABASE_URL: url };
  let client: PrismaClient | null = null;
  return {
    url,
    env,
    /** Copia as migrações dadas (que ainda não estão na cópia) e roda `prisma migrate deploy`. */
    deploy(names: string[]) {
      for (const name of names) cpSync(join(MIGRATIONS, name), join(prismaDir, "migrations", name), { recursive: true });
      execFileSync("npx", ["prisma", "migrate", "deploy", "--schema", join(prismaDir, "schema.prisma")], { cwd: ROOT, env, stdio: "pipe" });
    },
    client() {
      client ??= new PrismaClient({ datasourceUrl: url });
      return client;
    },
    /** Roda um script de `scripts/` contra este banco; devolve código de saída e saída. */
    run(script: string, args: string[] = [], extraEnv: Record<string, string> = {}) {
      const r = spawnSync(process.execPath, [join(ROOT, "scripts", script), ...args], {
        cwd: ROOT,
        env: { ...env, ...extraEnv },
        encoding: "utf8",
      });
      return { status: r.status, stdout: r.stdout, stderr: r.stderr };
    },
    async dispose() {
      await client?.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
