/**
 * `check-env.js` (026-producao): empacotado no build da imagem e chamado por `docker/entrypoint.sh`
 * ANTES do `prisma migrate deploy`. Configuração inválida → mensagem com os nomes das variáveis
 * (nunca os valores) e saída 1, sem tocar no banco.
 */
import { mensagemDeRecusa, validarAmbiente } from "./env";
import { log } from "./log";

const r = validarAmbiente(process.env);
for (const aviso of r.avisos) log("warn", "env.aviso", { msg: aviso });
if (!r.ok) {
  log("error", "env.invalido", { msg: mensagemDeRecusa(r.erros), variaveis: r.erros.map((e) => e.split(":")[0]) });
  process.stderr.write(mensagemDeRecusa(r.erros) + "\n");
  process.exit(1);
}
