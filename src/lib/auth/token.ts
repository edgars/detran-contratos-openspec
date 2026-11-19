/**
 * Token de sessão assinado (`<id>.<assinatura>`), verificável no middleware (runtime edge)
 * sem acesso ao banco. A validade real (logout, expiração) é conferida no servidor em session.ts.
 * 001b-security-baseline › security.
 */
export const SESSION_COOKIE = "sessao";

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return secret;
}

export function randomToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function signToken(id: string, secret = authSecret()): Promise<string> {
  return `${id}.${await hmac(id, secret)}`;
}

/** Devolve o id da sessão se a assinatura confere; `null` caso contrário. */
export async function verifyToken(token: string | undefined | null, secret = authSecret()): Promise<string | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const expected = await hmac(id, secret);
  const given = token.slice(dot + 1);
  if (expected.length !== given.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0 ? id : null;
}

export async function sha256(value: string): Promise<string> {
  return toBase64Url(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}
