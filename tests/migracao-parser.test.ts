import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// 025-migracao-legado › "Entrada em dump do mysqldump" (tasks 2.1 e 2.2).
const banco = await vi.hoisted(async () => (await import("./helpers/dump-sintetico")).prepararBancoMigracao());

import { prisma } from "@/lib/db";
import { DumpError, lerDumps } from "@/lib/migracao/dump-parser";
import { executarCarga } from "@/lib/migracao/carga";
import { COLUNAS_DESCARTADAS, bancosDaTabela } from "@/lib/migracao/mapa";
import { contagensFecham } from "@/lib/migracao/relatorio";
import { HASH_LEGADO, OBJETO_OBRIEN, gerarDumpSintetico, inserir, limparBanco, remover } from "./helpers/dump-sintetico";

const tmp = mkdtempSync(join(tmpdir(), "parser-025-"));
const arquivo = (nome: string, conteudo: string | Buffer) => {
  const p = join(tmp, nome);
  writeFileSync(p, conteudo);
  return p;
};
const rel = (nome: string) => join(tmp, `${nome}.json`);

afterAll(async () => {
  await prisma.$disconnect();
  await banco.dispose();
});
beforeEach(() => limparBanco(prisma, banco.uploads));

describe("dump sintético (D12)", () => {
  it("o dump gerado é lido sem erro pelo parser, com USE, LOCK TABLES e INSERT estendido", async () => {
    const d = gerarDumpSintetico();
    const dump = await lerDumps([d.contratos, d.global], { descartar: COLUNAS_DESCARTADAS });
    expect([...dump.tabelas.keys()]).toEqual(expect.arrayContaining(["contratos.contratos", "contratos.users", "global.pessoas_fisicas"]));
    const contratos = dump.tabelas.get("contratos.contratos")!;
    expect(contratos.chavePrimaria).toEqual(["id"]);
    expect(contratos.linhas).toHaveLength(5);
    expect(dump.tabelas.get("global.pessoas_fisicas")!.chavePrimaria).toEqual(["IdPessoaFisica"]);
  });

  it("a senha do legado é descartada já no parser (users.password sempre nulo)", async () => {
    const d = gerarDumpSintetico();
    const dump = await lerDumps([d.contratos, d.global], { descartar: COLUNAS_DESCARTADAS });
    const users = dump.tabelas.get("contratos.users")!;
    const i = users.colunas.findIndex((c) => c.nome === "password");
    expect(users.linhas.every((l) => l[i] === null)).toBe(true);
    expect(JSON.stringify(users.linhas)).not.toContain(HASH_LEGADO);
  });
});

describe("Requirement: Entrada em dump do mysqldump", () => {
  it("Scenario: Dump com várias linhas por INSERT — 3 contratos lidos e objeto O'Brien\\nRJ", async () => {
    const d = gerarDumpSintetico({
      ajustar: (x) => {
        const c = x.contratos.contratos;
        remover(c, 20, 10, 11, 12, 13);
        inserir(
          c,
          { id: 1, objeto: OBJETO_OBRIEN, data_inicio: "2020-01-01" },
          { id: 2, objeto: "Dois", data_inicio: "2020-01-01" },
          { id: 3, objeto: "Três", data_inicio: "2020-01-01" },
        );
      },
    });
    const texto = (await import("node:fs")).readFileSync(d.contratos, "utf8");
    expect(texto).toMatch(/INSERT INTO `contratos` VALUES \(1,.*\),\(2,.*\),\(3,.*\);/);
    expect(texto).toContain("O\\'Brien\\nRJ");
    const r = await executarCarga({ origens: [d.contratos, d.global], simular: true, relatorio: rel("varias-linhas") });
    expect(contagensFecham(r.relatorio)).toEqual([]);
    expect(r.relatorio.tabelas.find((t) => t.destino === "contratos")!.lidas).toBe(3);
    const dump = await lerDumps([d.contratos, d.global]);
    const t = dump.tabelas.get("contratos.contratos")!;
    const objeto = t.linhas[0][t.colunas.findIndex((c) => c.nome === "objeto")];
    expect(objeto).toBe("O'Brien\nRJ");
  });

  it("Scenario: Arquivo que não é dump (PDF) — código 1, mensagem e nenhuma tabela alterada", async () => {
    const pdf = arquivo("contrato.pdf", Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from([0xff, 0xfe, 0x00, 0x81, 0x9f])]));
    const d = gerarDumpSintetico();
    const r = await executarCarga({ origens: [pdf, d.global], simular: true, relatorio: rel("pdf") });
    expect(r.codigo).toBe(1);
    expect(r.resumo).toContain("não parece um dump do mysqldump");
    expect(await prisma.migracaoExecucao.count()).toBe(0);
    expect(await prisma.pessoaFisica.count()).toBe(0);
  });

  it("Scenario: Arquivo que não é dump (CSV) — código 1 e a mesma mensagem", async () => {
    const csv = arquivo("contratos.csv", "id;numero_processo;objeto\n1;E-12/001;Limpeza\n");
    const r = await executarCarga({ origens: [csv], confirmar: true, relatorio: rel("csv") });
    expect(r.codigo).toBe(1);
    expect(r.relatorio.erros.join(" ")).toContain("não parece um dump do mysqldump");
    expect(await prisma.contrato.count()).toBe(0);
  });
});

describe("parser — escapes, NULL, hex, lista de colunas, codificação", () => {
  const ct = "CREATE TABLE `t` (\n  `id` int(11) NOT NULL,\n  `txt` varchar(50) DEFAULT NULL,\n  `v` float DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB;\n";

  it("cada escape do MySQL (\\\\ \\' \\\" \\n \\r \\t \\0 \\Z '') e NULL; números ficam como texto", async () => {
    const f = arquivo(
      "contratos-esc.sql",
      `USE \`contratos\`;\n${ct}INSERT INTO \`t\` VALUES (1,'a\\\\b',1234.565),(2,'d\\'a\\"g',NULL),(3,'l1\\nl2\\rl3\\tx',-0.1),(4,'z\\0y\\Zw',1.5e6),(5,'It''s',0),(6,NULL,NULL);\n`,
    );
    const t = (await lerDumps([f])).tabelas.get("contratos.t")!;
    expect(t.linhas.map((l) => l[1])).toEqual(["a\\b", "d'a\"g", "l1\nl2\rl3\tx", "z\0y\x1aw", "It's", null]);
    expect(t.linhas.map((l) => l[2])).toEqual(["1234.565", null, "-0.1", "1.5e6", "0", null]);
    for (const l of t.linhas) for (const v of l) expect(v === null || typeof v === "string").toBe(true);
  });

  it("valores 0x… (hex-blob) e X'…' viram texto", async () => {
    const f = arquivo("contratos-hex.sql", `USE contratos;\n${ct}INSERT INTO t VALUES (1,0x4F4B,NULL),(2,X'6869',NULL),(3,0x,NULL);\n`);
    const t = (await lerDumps([f])).tabelas.get("contratos.t")!;
    expect(t.linhas.map((l) => l[1])).toEqual(["OK", "hi", ""]);
  });

  it("INSERT com lista de colunas em outra ordem", async () => {
    const f = arquivo("contratos-cols.sql", `USE contratos;\n${ct}INSERT INTO \`t\` (\`txt\`, \`id\`) VALUES ('x',7),('y',8);\n`);
    const t = (await lerDumps([f])).tabelas.get("contratos.t")!;
    expect(t.linhas).toEqual([
      ["7", "x", null],
      ["8", "y", null],
    ]);
  });

  it("UTF-8 inválido aborta sugerindo --encoding latin1; com latin1 o texto é lido", async () => {
    const latin1 = Buffer.concat([
      Buffer.from(`USE contratos;\n${ct}INSERT INTO t VALUES (1,'Jos`, "latin1"),
      Buffer.from([0xe9]),
      Buffer.from("',NULL);\n", "latin1"),
    ]);
    const f = arquivo("contratos-latin1.sql", latin1);
    await expect(lerDumps([f])).rejects.toThrow(/--encoding latin1/);
    const t = (await lerDumps([f], { encoding: "latin1" })).tabelas.get("contratos.t")!;
    expect(t.linhas[0][1]).toBe("José");
  });

  it("banco pelo nome do arquivo sem USE; tabela ambígua quando o banco não é dedutível", async () => {
    const semUse = gerarDumpSintetico({ use: false });
    const dump = await lerDumps([semUse.contratos, semUse.global], { bancoDaTabela: bancosDaTabela });
    expect(dump.tabelas.has("global.departamentos")).toBe(true);
    expect(dump.tabelas.has("contratos.contratos")).toBe(true);
    const a = arquivo("dump-a.sql", ct);
    const b = arquivo("dump-b.sql", ct);
    await expect(lerDumps([a, b])).rejects.toThrow(/tabela ambígua/);
    await expect(lerDumps([a, b])).rejects.toBeInstanceOf(DumpError);
  });
});
