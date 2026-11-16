/**
 * Cabeçalhos de segurança de toda resposta de página e de `/api` (026-producao › design.md › Cabeçalhos de
 * segurança). Função pura, sem servidor: o middleware chama com o nonce da requisição e `FRAME_ANCESTORS`.
 */

export type SecurityHeadersInput = {
  nonce: string;
  /** Origens `https://` da prévia em iframe (já separadas); vazio → só `'self'` e `X-Frame-Options`. */
  frameAncestors?: string[];
  /** `next dev` precisa de `'unsafe-eval'` (React Refresh); nunca em produção. */
  dev?: boolean;
};

/** Normaliza uma origem da lista (sem barra final); item inválido fica de fora (o start já recusa em produção). */
function origem(valor: string): string | null {
  try {
    const u = new URL(valor);
    return u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

const origensValidas = (lista: string[] = []) => lista.map(origem).filter((o): o is string => !!o);

export function contentSecurityPolicy({ nonce, frameAncestors = [], dev = false }: SecurityHeadersInput): string {
  const ancestors = ["'self'", ...origensValidas(frameAncestors)];
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // shadcn/ui (base-ui), sonner e o Next aplicam style="" inline: sem isso a interface quebra (risco aceito).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${ancestors.join(" ")}`,
  ].join("; ");
}

export function securityHeaders(input: SecurityHeadersInput): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": contentSecurityPolicy(input),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  // X-Frame-Options não aceita uma origem específica: com prévia configurada ele sai, e vale só o frame-ancestors.
  if (!origensValidas(input.frameAncestors).length) headers["X-Frame-Options"] = "SAMEORIGIN";
  return headers;
}

/** Nonce de 16 bytes aleatórios em base64, novo a cada requisição. */
export function novoNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
