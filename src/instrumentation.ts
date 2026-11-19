/**
 * Start do Next.js (026-producao › Configuração validada no start): em produção, configuração inválida
 * encerra o processo com a mensagem que cita só os nomes das variáveis. O container já valida antes, em
 * `check-env.js`; aqui cobre `npm start` fora do container.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { mensagemDeRecusa, validarAmbiente } = await import("@/lib/env");
  const { log } = await import("@/lib/log");
  const r = validarAmbiente(process.env);
  for (const aviso of r.avisos) log("warn", "env.aviso", { msg: aviso });
  if (!r.ok) {
    log("error", "env.invalido", { msg: mensagemDeRecusa(r.erros), variaveis: r.erros.map((e) => e.split(":")[0]) });
    process.exit(1);
  }
}
