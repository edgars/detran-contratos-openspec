// Smoke test da aplicação no ar (001-project-foundation 6.1, 018-deployment 3.1).
// Uso: BASE_URL=http://localhost:3000 SMOKE_USER=admin SMOKE_PASSWORD=... npm run smoke
// SMOKE_CREATE=<nome> cria uma modalidade; SMOKE_ONLY_CHECK=<nome> só confere que ela existe (teste de reinício).
const base = process.env.BASE_URL ?? "http://localhost:3000";
const user = process.env.SMOKE_USER ?? process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.SMOKE_PASSWORD ?? process.env.ADMIN_PASSWORD;
let failed = 0;
const log = (ok, msg) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
};

// Sem sessão: páginas vão para o login e a API responde 401.
let res = await fetch(`${base}/contratos`, { redirect: "manual" });
log(res.status === 307 && res.headers.get("location")?.includes("/login"), `${res.status} /contratos sem sessão → /login`);
res = await fetch(`${base}/api/contratos`);
log(res.status === 401, `${res.status} /api/contratos sem sessão → 401`);

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
