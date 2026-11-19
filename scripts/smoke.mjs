// Smoke test (001-project-foundation, tarefa 6.1): com o app no ar, abre a página inicial,
// cada item da navegação e cada API de referência. Uso: BASE_URL=http://localhost:3000 npm run smoke
const base = process.env.BASE_URL ?? "http://localhost:3000";
const pages = [
  "/", "/departamentos", "/tipo_contratos", "/contrato_status", "/users", "/pagamentos", "/modalidades",
  "/prestacao_contas", "/fases", "/fiscais", "/status", "/historicos", "/anexos_fiscais",
  "/situacao_contratuals", "/anexos_publicacaos", "/penalidades", "/contratos",
];
const apis = ["diretorias", "pessoas_fisicas", "pessoas", "prestadores_servicos", "groups_users", "pagamento_arquivos", "groups"];

let failed = 0;
async function check(path, expect) {
  const res = await fetch(base + path);
  const ok = expect(res);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${res.status} ${path}`);
}

for (const path of pages) await check(path, (r) => r.status === 200);
for (const t of apis) await check(`/api/${t}`, (r) => r.status === 200);
for (const t of apis) {
  const res = await fetch(`${base}/api/${t}`, { method: "POST", body: "{}" });
  const ok = res.status === 405;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${res.status} POST /api/${t} (esperado 405)`);
}
await check("/rota-inexistente", (r) => r.status === 404);

if (failed) {
  console.error(`${failed} verificação(ões) falharam`);
  process.exit(1);
}
console.log("smoke ok");
