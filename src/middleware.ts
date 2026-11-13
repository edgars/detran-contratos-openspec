import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders } from "@/lib/api/cors";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth/token";

/** Rotas acessíveis sem sessão (001b-security-baseline › "Login obrigatório"). */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/api/auth/");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const headers = isApi ? corsHeaders(request.headers.get("origin"), process.env.APP_ORIGIN) : new Headers();
  if (isApi && request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });

  if (!isPublicPath(pathname)) {
    // Só o cookie vale: um id de sessão na URL, no corpo ou em header customizado é ignorado.
    const secret = process.env.AUTH_SECRET;
    const sessionId = secret ? await verifyToken(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
    if (!sessionId) {
      if (isApi) return NextResponse.json({ error: "Sessão inválida" }, { status: 401, headers });
      const login = new URL("/login", request.url);
      if (pathname !== "/") login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
  }

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
