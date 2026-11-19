/** Cabeçalhos CORS: só a origem configurada em `APP_ORIGIN` recebe permissão. */
export function corsHeaders(origin: string | null, allowed: string | undefined): Headers {
  const headers = new Headers();
  if (origin && allowed && origin === allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Vary", "Origin");
  }
  return headers;
}
