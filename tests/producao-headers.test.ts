import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { contentSecurityPolicy, novoNonce, securityHeaders } from "@/lib/security-headers";
import { SESSION_COOKIE } from "@/lib/auth/token";
import { loginAs } from "./helpers/auth";
import { getCookie } from "./helpers/next-headers-mock";

// 026-producao › "Cabeçalhos de segurança", "Nonce de script por requisição", "Enquadramento compatível com a prévia".

const nonceDe = (csp: string | null) => csp?.match(/'nonce-([^']+)'/)?.[1];

async function paginaLogada(path = "/contratos") {
  await loginAs();
  const cookie = getCookie(SESSION_COOKIE)!;
  return middleware(new NextRequest(`http://localhost${path}`, { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
}

function confereTodos(h: Headers) {
  const csp = h.get("content-security-policy")!;
  expect(csp).toContain("default-src 'self'");
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");
  expect(csp).toContain("frame-ancestors 'self'");
  expect(csp).not.toContain("unsafe-eval");
  expect(h.get("x-content-type-options")).toBe("nosniff");
  expect(h.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(h.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=(), payment=()");
  expect(h.get("cross-origin-opener-policy")).toBe("same-origin");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("026-producao › securityHeaders (task 2.1, unitário)", () => {
  it("tabela de design.md: cada cabeçalho com o valor esperado", () => {
    const h = securityHeaders({ nonce: "abc123==" });
    expect(h["Content-Security-Policy"]).toBe(
      "default-src 'self'; script-src 'self' 'nonce-abc123==' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; " +
        "form-action 'self'; frame-ancestors 'self'",
    );
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("sem FRAME_ANCESTORS: frame-ancestors 'self' e X-Frame-Options: SAMEORIGIN", () => {
    const h = securityHeaders({ nonce: "n", frameAncestors: [] });
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
    expect(h["X-Frame-Options"]).toBe("SAMEORIGIN");
  });

  it("com FRAME_ANCESTORS: frame-ancestors 'self' https://previa.exemplo e sem X-Frame-Options", () => {
    const h = securityHeaders({ nonce: "n", frameAncestors: ["https://previa.exemplo"] });
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'self' https://previa.exemplo");
    expect(h).not.toHaveProperty("X-Frame-Options");
  });

  it("'unsafe-eval' só no modo dev (React Refresh do next dev)", () => {
    expect(contentSecurityPolicy({ nonce: "n", dev: true })).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy({ nonce: "n" })).not.toContain("'unsafe-eval'");
  });

  it("nonce: 16 bytes em base64, diferente a cada chamada", () => {
    const a = novoNonce();
    expect(atob(a)).toHaveLength(16);
    expect(novoNonce()).not.toBe(a);
  });
});

describe("026-producao › middleware (task 2.2)", () => {
  it("Cabeçalhos numa página: usuário logado abre /contratos e a resposta traz todos os cabeçalhos", async () => {
    const res = await paginaLogada();
    expect(res.status).toBe(200);
    confereTodos(res.headers);
    // O nonce segue para a renderização: x-nonce e CSP no cabeçalho da requisição (padrão do Next.js 15).
    const nonce = nonceDe(res.headers.get("content-security-policy"));
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(nonceDe(res.headers.get("x-middleware-request-content-security-policy"))).toBe(nonce);
  });

  it("Nonce por requisição: a mesma página pedida duas vezes tem nonces diferentes", async () => {
    const a = nonceDe((await paginaLogada()).headers.get("content-security-policy"));
    const b = nonceDe((await paginaLogada()).headers.get("content-security-policy"));
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("Resposta 401 também protegida: GET /api/contratos sem sessão → 401 com nosniff e CSP", async () => {
    const res = await middleware(new NextRequest("http://localhost/api/contratos"));
    expect(res.status).toBe(401);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("redirecionamento para /login também leva os cabeçalhos", async () => {
    const res = await middleware(new NextRequest("http://localhost/contratos"));
    expect([307, 308]).toContain(res.status);
    confereTodos(res.headers);
  });

  it("Produção sem prévia: FRAME_ANCESTORS vazio → X-Frame-Options: SAMEORIGIN e frame-ancestors 'self'", async () => {
    vi.stubEnv("FRAME_ANCESTORS", "");
    const res = await middleware(new NextRequest("http://localhost/login"));
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("content-security-policy")).toMatch(/frame-ancestors 'self'$/);
  });

  it("Prévia autorizada: FRAME_ANCESTORS=https://previa.exemplo → frame-ancestors com a origem e sem X-Frame-Options", async () => {
    vi.stubEnv("FRAME_ANCESTORS", "https://previa.exemplo");
    vi.stubEnv("COOKIE_SAMESITE", "none");
    const res = await middleware(new NextRequest("http://localhost/login"));
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'self' https://previa.exemplo");
    expect(res.headers.get("x-frame-options")).toBeNull();
  });
});
