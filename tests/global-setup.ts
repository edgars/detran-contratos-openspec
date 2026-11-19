import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/** Banco de teste novo a cada execução, com as migrações versionadas aplicadas. */
export default function setup() {
  const file = process.env.TEST_DB_FILE ?? "data/test.db";
  rmSync(file, { force: true });
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: `file:../${file}` },
    stdio: "ignore",
  });
  return () => rmSync(file, { force: true });
}
