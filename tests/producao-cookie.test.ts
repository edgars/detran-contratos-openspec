import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { afterEach, describe, expect, it } from "vitest";
import { ResponseCookies } from "next/dist/server/web/spec-extension/cookies";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/token";
import * as loginRoute from "@/app/api/auth/login/route";
import { jsonRequest } from "./helpers/auth";
import { getCookie, getCookieOptions, resetCookies } from "./helpers/next-headers-mock";

vi.setConfig({ testTimeout: 30_000 });

/** `Set-Cookie` que o Next montaria com o valor e as opções gravadas por `createSession`. */
function setCookieHeader(): string {
  const headers = new Headers();
  new ResponseCookies(headers).set(SESSION_COOKIE, getCookie(SESSION_COOKIE)!, getCookieOptions(SESSION_COOKIE) as never);
  return headers.get("set-cookie") ?? "";
}

async function loginProducao() {
  await prisma.user.upsert({
    where: { username: "operador.prod" },
    update: {},
    create: { username: "operador.prod", passwordHash: await hashPassword("Senha-Prod-1") },
  });
  resetCookies();
  const res = await loginRoute.POST(jsonRequest("/api/auth/login", "POST", { username: "operador.prod", password: "Senha-Prod-1" }));
  expect(res.status).toBe(200);
  return setCookieHeader();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("026-producao › Cookie de sessão seguro em produção", () => {
  it("Login em produção: Set-Cookie da sessão com Secure, HttpOnly e SameSite=Lax", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");
    vi.stubEnv("COOKIE_SAMESITE", "");
    const header = await loginProducao();
    expect(header).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    expect(header).toMatch(/;\s*Secure/i);
    expect(header).toMatch(/;\s*HttpOnly/i);
    expect(header).toMatch(/;\s*SameSite=Lax/i);
  });

  it("COOKIE_SAMESITE=none (prévia em iframe): SameSite=None e Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SAMESITE", "none");
    const header = await loginProducao();
    expect(header).toMatch(/;\s*SameSite=None/i);
    expect(header).toMatch(/;\s*Secure/i);
    // Sem Partitioned, navegadores que bloqueiam cookie de terceiros descartam a sessão dentro do iframe.
    expect(header).toMatch(/;\s*Partitioned/i);
  });

  it("Fora do iframe o cookie não é Partitioned", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SAMESITE", "");
    const header = await loginProducao();
    expect(header).not.toMatch(/Partitioned/i);
  });
});
