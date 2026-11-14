/**
 * Substituto de `next/headers` para testes de rotas: um cookie store em memória.
 * Uso no arquivo de teste:  vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
 */
type Cookie = { name: string; value: string };
const jar = new Map<string, string>();

export function resetCookies() {
  jar.clear();
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
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
    has: (name: string) => jar.has(name),
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
  };
}

export async function headers() {
  return new Headers();
}
