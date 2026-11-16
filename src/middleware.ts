import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders } from "@/lib/api/cors";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth/token";
import { log } from "@/lib/log";
import { contentSecurityPolicy, novoNonce, securityHeaders } from "@/lib/security-headers";

/**
 * Rotas acessíveis sem sessão (001b-security-baseline › "Login obrigatório"): `/login`, `/api/auth/*` e,
 * desde a 026-producao (aceito pelo autor em 14/11/2026), só `GET /api/health` — caminho exato e só GET.
 */
export function isPublicPath(pathname: string, method = "GET"): boolean {
  if (pathname === "/api/health") return method === "GET";
  return pathname === "/login" || pathname.startsWith("/api/auth/");
}

/** Entrada dos cabeçalhos: nonce da requisição, origens da prévia (`FRAME_ANCESTORS`) e modo dev. */
const entrada = (nonce: string) => ({
  nonce,
  frameAncestors: (process.env.FRAME_ANCESTORS ?? "").split(/\s+/).filter(Boolean),
  dev: process.env.NODE_ENV === "development",
});

/** Cabeçalhos de segurança da 026 (CSP com nonce, nosniff, Referrer-Policy, …) numa resposta pronta. */
function protect(response: NextResponse, nonce: string) {
  for (const [k, v] of Object.entries(securityHeaders(entrada(nonce)))) response.headers.set(k, v);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const nonce = novoNonce();
  const headers = isApi ? corsHeaders(request.headers.get("origin"), process.env.APP_ORIGIN) : new Headers();
  if (isApi && request.method === "OPTIONS") return protect(new NextResponse(null, { status: 204, headers }), nonce);

  if (!isPublicPath(pathname, request.method)) {
    // Só o cookie vale: um id de sessão na URL, no corpo ou em header customizado é ignorado.
    const secret = process.env.AUTH_SECRET;
    const sessionId = secret ? await verifyToken(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
    if (!sessionId) {
      if (isApi) {
        log("info", "sessao.invalida", { rota: pathname, metodo: request.method, status: 401 });
        return protect(NextResponse.json({ error: "Sessão inválida" }, { status: 401, headers }), nonce);
      }
      const login = new URL("/login", request.url);
      if (pathname !== "/") login.searchParams.set("next", pathname + search);
      return protect(NextResponse.redirect(login), nonce);
    }
  }

  // O nonce segue para a renderização (padrão do Next.js 15): `x-nonce` para o layout e o CSP no
  // cabeçalho da requisição, de onde o Next tira o nonce dos próprios scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy(entrada(nonce)));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  headers.forEach((value, key) => response.headers.set(key, value));
  return protect(response, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|ico|woff2)$).*)"],
};
