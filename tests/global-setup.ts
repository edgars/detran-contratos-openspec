import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/** Banco de teste novo a cada execução, com as migrações versionadas aplicadas. */
export default function setup() {
  rmSync("data/test.db", { force: true });
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:../data/test.db" },
    stdio: "ignore",
  });
}
