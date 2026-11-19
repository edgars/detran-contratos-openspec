import type { NextConfig } from "next";

/**
 * Corpo máximo que o Next entrega às rotas depois do middleware (padrão do Next 15.5: 10 MB, e o excedente é
 * cortado — um PDF entre 10 MB e `UPLOAD_MAX_MB` virava 500). 026-producao: o portão é o proxy
 * (`PROXY_MAX_BODY_MB`, 413) e o limite do app é o de `savePdf()`; este valor só precisa ser maior que os dois.
 * Mesmo valor de `CORPO_MAX_MB` em `src/lib/env.ts`, que recusa `PROXY_MAX_BODY_MB` acima dele (teste em
 * tests/producao-env.test.ts confere que os dois batem).
 */
const CORPO_MAX_MB = 100;

const nextConfig: NextConfig = {
  output: "standalone",
  // 026-producao: sem X-Powered-By (o proxy também remove o Server).
  poweredByHeader: false,
  experimental: {
    middlewareClientMaxBodySize: `${CORPO_MAX_MB}mb`,
  },
};

export default nextConfig;
