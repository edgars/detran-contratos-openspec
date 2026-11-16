// Smoke test da aplicação no ar (001-project-foundation 6.1, 018-deployment 3.1).
// Uso: BASE_URL=http://localhost:3000 SMOKE_USER=admin SMOKE_PASSWORD=... npm run smoke
// SMOKE_CREATE=<nome> cria uma modalidade; SMOKE_ONLY_CHECK=<nome> só confere que ela existe (teste de reinício).
// 026-producao: BASE_URL=https://<SITE_ADDRESS> passa pelo proxy e confere também o HSTS; SMOKE_INSECURE=1 aceita
// certificado não confiável (CADDY_TLS=internal). Os cabeçalhos de segurança são conferidos em /login e num 401.
if (process.env.SMOKE_INSECURE === "1") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const base = process.env.BASE_URL ?? "http://localhost:3000";
const user = process.env.SMOKE_USER ?? process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.SMOKE_PASSWORD ?? process.env.ADMIN_PASSWORD;
let failed = 0;
let res;
const log = (ok, msg) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
};

/** Cabeçalhos de segurança da 026 (src/lib/security-headers.ts) e, por HTTPS, o HSTS do proxy. */
function securityHeadersOk(res, onde) {
  const h = res.headers;
  const csp = h.get("content-security-policy") ?? "";
  const checks = [
    [/default-src 'self'/.test(csp) && /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(csp), "CSP com nonce"],
    [/object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp) && /form-action 'self'/.test(csp) && /frame-ancestors 'self'/.test(csp), "CSP object-src/base-uri/form-action/frame-ancestors"],
    [h.get("x-content-type-options") === "nosniff", "X-Content-Type-Options"],
    [h.get("referrer-policy") === "strict-origin-when-cross-origin", "Referrer-Policy"],
    [/camera=\(\)/.test(h.get("permissions-policy") ?? ""), "Permissions-Policy"],
    [h.get("cross-origin-opener-policy") === "same-origin", "Cross-Origin-Opener-Policy"],
  ];
  if (base.startsWith("https://")) checks.push([h.get("strict-transport-security") === "max-age=31536000", "HSTS"]);
  for (const [ok, nome] of checks) log(ok, `${onde}: ${nome}`);
}

res = await fetch(`${base}/login`);
log(res.status === 200, `${res.status} /login`);
securityHeadersOk(res, "/login");

// Sem sessão: páginas vão para o login e a API responde 401.
res = await fetch(`${base}/contratos`, { redirect: "manual" });
log(res.status === 307 && res.headers.get("location")?.includes("/login"), `${res.status} /contratos sem sessão → /login`);
res = await fetch(`${base}/api/contratos`);
log(res.status === 401, `${res.status} /api/contratos sem sessão → 401`);
securityHeadersOk(res, "401 /api/contratos");

res = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: user, password }),
});
log(res.ok, `${res.status} login de ${user}`);
const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
const get = (path, init = {}) => fetch(base + path, { ...init, redirect: "manual", headers: { cookie, ...(init.headers ?? {}) } });

if (process.env.SMOKE_ONLY_CHECK) {
  const body = await (await get(`/api/modalidades?q=${encodeURIComponent(process.env.SMOKE_ONLY_CHECK)}`)).json();
  log(body.total >= 1, `modalidade "${process.env.SMOKE_ONLY_CHECK}" sobreviveu ao reinício`);
} else {
  const pages = ["/", "/departamentos", "/tipo_contratos", "/contrato_status", "/users", "/pagamentos", "/modalidades",
    "/prestacao_contas", "/fases", "/fiscais", "/status", "/historicos", "/anexos_fiscais", "/situacao_contratuals",
    "/anexos_publicacaos", "/penalidades", "/contratos", "/contratos/new", "/conta/senha"];
  for (const p of pages) {
    const r = await get(p);
    log(r.status === 200, `${r.status} ${p}`);
  }
  const apis = ["departamentos", "tipo_contratos", "contrato_status", "users", "pagamentos", "modalidades", "prestacao_contas",
    "fases", "fiscais", "status", "historicos", "anexos_fiscais", "situacao_contratual", "anexos_publicacaos", "penalidades",
    "contratos", "diretorias", "pessoas_fisicas", "prestadores_servicos"];
  for (const a of apis) {
    const r = await get(`/api/${a}`);
    log(r.status === 200, `${r.status} /api/${a}`);
  }
  const users = await (await get("/api/users")).json();
  log(!JSON.stringify(users).includes("passwordHash"), "nenhuma senha na API de usuários");
  if (process.env.SMOKE_CREATE) {
    const r = await get("/api/modalidades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: process.env.SMOKE_CREATE }),
    });
    log(r.status === 201, `${r.status} modalidade "${process.env.SMOKE_CREATE}" criada`);
  }
}

if (failed) {
  console.error(`${failed} verificação(ões) falharam`);
  process.exit(1);
}
console.log("smoke ok");
