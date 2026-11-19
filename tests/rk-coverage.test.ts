import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Toda regra da seção "4. Regras transversais" de tasks.md tem um comentário `// RK-…` no
 * código-fonte, no ponto onde é aplicada, e um teste que cita a mesma chave.
 */
const tasks = readFileSync("openspec/changes/001-project-foundation/tasks.md", "utf8");
const section = tasks.split("## 4. Regras transversais")[1].split("## 5.")[0];
const keys = [...new Set(section.match(/RK-[0-9a-f]{12}/g) ?? [])];

function readTree(dir: string): string {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .map((path) => (statSync(path).isDirectory() ? readTree(path) : readFileSync(path, "utf8")))
    .join("\n");
}

const source = readTree("src");
const commentLines = source.split("\n").filter((line) => line.trim().startsWith("//") || line.includes("// RK-"));
const testSource = readFileSync("tests/rules.test.ts", "utf8");

describe("rastreabilidade das regras transversais", () => {
  it("tasks.md lista as 50 tarefas de regra", () => {
    expect(section.match(/- \[[ x]\] 4\.\d+/g)).toHaveLength(50);
  });

  for (const key of keys) {
    it(`${key} tem comentário no código e teste`, () => {
      expect(commentLines.some((line) => line.includes(key))).toBe(true);
      expect(testSource.includes(key)).toBe(true);
    });
  }
});
