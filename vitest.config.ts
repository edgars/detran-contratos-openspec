import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Banco de teste próprio por execução: vários `vitest run` podem rodar ao mesmo tempo.
const testDb = `data/test-${process.pid}.db`;
process.env.TEST_DB_FILE = testDb;
process.env.DATABASE_URL = `file:../${testDb}`;

export default defineConfig({
  plugins: [tsconfigPaths()],
  // JSX automático: testes que renderizam componentes não precisam de React global.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: { DATABASE_URL: process.env.DATABASE_URL, TEST_DB_FILE: testDb, AUTH_SECRET: "test-secret", UPLOAD_DIR: "data/uploads-test" },
    fileParallelism: false,
  },
});
