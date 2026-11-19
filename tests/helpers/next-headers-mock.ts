/**
 * Substituto de `next/headers` para testes de rotas: um cookie store em memória.
 * Uso no arquivo de teste:  vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
 */
type Cookie = { name: string; value: string };
const jar = new Map<string, string>();
/** Opções do último `set` de cada cookie (026-producao: Secure, HttpOnly, SameSite do cookie de sessão). */
const options = new Map<string, Record<string, unknown>>();

export function resetCookies() {
  jar.clear();
  options.clear();
}

export function getCookieOptions(name: string) {
  return options.get(name);
}

export function setCookie(name: string, value: string) {
  jar.set(name, value);
}

export function getCookie(name: string) {
  return jar.get(name);
}

export async function cookies() {
  return {
    get: (name: string): Cookie | undefined => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string, opts?: Record<string, unknown>) => {
      // Como no navegador: cookie gravado já expirado (maxAge 0) é apagado.
      if (opts?.maxAge === 0) {
        jar.delete(name);
        options.set(name, opts);
        return;
      }
      jar.set(name, value);
      options.set(name, opts ?? {});
    },
    delete: (name: string) => void jar.delete(name),
    has: (name: string) => jar.has(name),
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
  };
}

export async function headers() {
  return new Headers();
}
