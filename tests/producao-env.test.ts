import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CORPO_MAX_MB, VARIAVEIS_VALIDADAS, bytesDoSegredo, mensagemDeRecusa, validarAmbiente } from "@/lib/env";

// 026-producao › "Configuração de produção validada no start" (tasks 1.1 e 9.1).

const SEGREDO_FORTE = "q1Hc0m8m2XvQ9pW0aV7l3bS8yZ4kN6tR5uE2iO9pL1A="; // 32 bytes em base64
const VALIDO: Record<string, string> = {
  NODE_ENV: "production",
  AUTH_SECRET: SEGREDO_FORTE,
  APP_ORIGIN: "https://contratos.detran.rj.gov.br",
  COOKIE_SECURE: "",
  COOKIE_SAMESITE: "",
  FRAME_ANCESTORS: "",
  UPLOAD_MAX_MB: "10",
  PROXY_MAX_BODY_MB: "11",
  DATABASE_URL: "file:/app/data/app.db",
  LOG_LEVEL: "info",
};

const com = (over: Record<string, string | undefined>) => validarAmbiente({ ...VALIDO, ...over });

describe("026-producao › Configuração de produção validada no start", () => {
  it("Configuração válida: todas as variáveis obrigatórias válidas → ok, sem erros", () => {
    expect(bytesDoSegredo(SEGREDO_FORTE)).toBe(32);
    expect(validarAmbiente(VALIDO)).toEqual({ ok: true, erros: [], avisos: [] });
  });

  it("fora de produção nada é recusado (dev e testes em HTTP)", () => {
    expect(validarAmbiente({ NODE_ENV: "development", COOKIE_SECURE: "false" }).ok).toBe(true);
  });

  it("Cookie inseguro em produção: COOKIE_SECURE=false é recusado citando COOKIE_SECURE", () => {
    const r = com({ COOKIE_SECURE: "false" });
    expect(r.ok).toBe(false);
    expect(r.erros.join()).toContain("COOKIE_SECURE");
  });

  it("Segredo fraco: AUTH_SECRET de 10 caracteres → erro citando AUTH_SECRET e sem o valor", () => {
    const r = com({ AUTH_SECRET: "abcdefghij" });
    expect(r.ok).toBe(false);
    const msg = mensagemDeRecusa(r.erros);
    expect(msg).toContain("AUTH_SECRET");
    expect(msg).not.toContain("abcdefghij");
    expect(com({ AUTH_SECRET: undefined }).erros.join()).toContain("AUTH_SECRET");
  });

  const invalidos: [string, string | undefined][] = [
    ["APP_ORIGIN", "http://contratos.detran.rj.gov.br"],
    ["COOKIE_SAMESITE", "strict"],
    ["FRAME_ANCESTORS", "https://ok.exemplo http://inseguro.exemplo"],
    ["UPLOAD_MAX_MB", "dez"],
    ["PROXY_MAX_BODY_MB", "10"], // não maior que UPLOAD_MAX_MB=10
    ["PROXY_MAX_BODY_MB", undefined],
    ["PROXY_MAX_BODY_MB", "101"], // acima do corpo máximo do Next (next.config.ts)
    ["DATABASE_URL", "postgres://banco/app"],
    ["LOG_LEVEL", "verbose"],
  ];
  for (const [nome, valor] of invalidos) {
    it(`${nome}=${valor ?? "(vazio)"} é recusado com o nome da variável e sem o valor`, () => {
      const r = com({ [nome]: valor });
      expect(r.ok).toBe(false);
      const msg = mensagemDeRecusa(r.erros);
      expect(msg).toContain(nome);
      if (valor) expect(msg).not.toContain(valor);
    });
  }

  it("CORPO_MAX_MB é o mesmo valor de middlewareClientMaxBodySize em next.config.ts", () => {
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toMatch(new RegExp(`const CORPO_MAX_MB = ${CORPO_MAX_MB};`));
    expect(config).toContain("middlewareClientMaxBodySize: `${CORPO_MAX_MB}mb`");
  });

  it("FRAME_ANCESTORS com origens https:// é aceito; COOKIE_SAMESITE=none é aceito", () => {
    expect(com({ FRAME_ANCESTORS: "https://previa.exemplo https://os.exemplo:8443", COOKIE_SAMESITE: "none" }).ok).toBe(true);
  });

  it("ADMIN_PASSWORD preenchido gera aviso, não erro, e o aviso não traz o valor", () => {
    const r = com({ ADMIN_PASSWORD: "Senha-Inicial-9" });
    expect(r.ok).toBe(true);
    expect(r.avisos.join()).toContain("ADMIN_PASSWORD");
    expect(r.avisos.join()).not.toContain("Senha-Inicial-9");
  });
});

describe("026-producao › task 9.1: .env.example documenta toda variável de produção", () => {
  const exemplo = readFileSync(".env.example", "utf8");
  const documentadas = new Set([...exemplo.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));

  it("variáveis de src/lib/env.ts", () => {
    for (const v of VARIAVEIS_VALIDADAS) expect(documentadas, v).toContain(v);
  });

  it("variáveis do Caddyfile ({$VAR})", () => {
    const caddy = readFileSync("docker/caddy/Caddyfile", "utf8");
    const usadas = [...caddy.matchAll(/\{\$([A-Z0-9_]+)/g)].map((m) => m[1]);
    expect(usadas.length).toBeGreaterThan(0);
    for (const v of usadas) expect(documentadas, v).toContain(v);
  });

  it("variáveis dos scripts de backup (${VAR} configuráveis)", () => {
    const internas = new Set(["DB", "BACKUPS", "UPLOADS", "SECRETS", "TS", "PATH", "HOME", "HOSTNAME"]);
    const dir = "docker/backup";
    const textos = readdirSync(dir)
      .filter((f) => f.endsWith(".sh") || f === "crontab" || f === "Dockerfile")
      .map((f) => readFileSync(join(dir, f), "utf8"));
    const usadas = new Set(textos.flatMap((t) => [...t.matchAll(/\$\{(BACKUP_[A-Z0-9_]+|TZ)[:}-]/g)].map((m) => m[1])));
    expect(usadas.size).toBeGreaterThan(0);
    for (const v of usadas) if (!internas.has(v)) expect(documentadas, v).toContain(v);
  });

  it("nenhum valor secreto no .env.example (AUTH_SECRET e ADMIN_PASSWORD vazios)", () => {
    expect(exemplo).toMatch(/^AUTH_SECRET=""$/m);
    expect(exemplo).toMatch(/^ADMIN_PASSWORD=""$/m);
  });
});
