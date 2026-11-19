// Carga dos dados do legado (025-migracao-legado, design.md D2). Só lê os argumentos e chama
// executarCarga() de src/lib/migracao/carga.ts, que é o que os testes usam.
//
// Uso: npm run migrar -- --origem <contratos.sql> --origem <global.sql> [--anexos <pasta>]
//                        [--encoding utf8|latin1] [--simular] [--confirmar] [--relatorio <arquivo.json>]

import { executarCarga } from "../src/lib/migracao/carga";
import { prisma } from "../src/lib/db";

const AJUDA = `Carga dos dados do legado (dump do mysqldump dos bancos contratos e global)

Uso:
  npm run migrar -- --origem <arquivo.sql> [--origem <arquivo.sql> …] [opções]

Opções:
  --origem <arquivo.sql>      dump de um banco (repita para cada banco: contratos e global)
  --anexos <pasta>            pasta com os PDFs copiados do servidor antigo (busca por nome, recursiva)
  --encoding utf8|latin1      codificação do dump (padrão: utf8)
  --simular                   executa tudo e desfaz no fim: nada é gravado, nenhum arquivo é copiado
  --confirmar                 obrigatório para a carga real (sem --simular)
  --relatorio <arquivo.json>  onde gravar o relatório (padrão: data/migracao/relatorio-<data-hora>[-simulacao].json)
  --help                      mostra esta ajuda

Banco de destino: DATABASE_URL. Anexos gravados em UPLOAD_DIR. Backup antes da carga real em
BACKUP_DIR (padrão data/backups/pre-migracao-<data-hora>.db).
Códigos de saída: 0 concluída sem rejeição; 2 concluída com rejeições; 1 abortada (nada gravado).`;

type Args = { origens: string[]; anexos?: string; encoding?: "utf8" | "latin1"; simular: boolean; confirmar: boolean; relatorio?: string; ajuda: boolean };

function lerArgs(argv: string[]): Args | string {
  const a: Args = { origens: [], simular: false, confirmar: false, ajuda: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const valor = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${arg} exige um valor`);
      return v;
    };
    try {
      if (arg === "--origem") a.origens.push(valor());
      else if (arg === "--anexos") a.anexos = valor();
      else if (arg === "--relatorio") a.relatorio = valor();
      else if (arg === "--encoding") {
        const e = valor();
        if (e !== "utf8" && e !== "latin1") return "--encoding aceita utf8 ou latin1";
        a.encoding = e;
      } else if (arg === "--simular") a.simular = true;
      else if (arg === "--confirmar") a.confirmar = true;
      else if (arg === "--help" || arg === "-h") a.ajuda = true;
      else return `opção desconhecida: ${arg}`;
    } catch (error) {
      return (error as Error).message;
    }
  }
  return a;
}

async function main(): Promise<number> {
  const args = lerArgs(process.argv.slice(2));
  if (typeof args === "string") {
    console.error(`${args}\n\n${AJUDA}`);
    return 1;
  }
  if (args.ajuda) {
    console.log(AJUDA);
    return 0;
  }
  if (!args.origens.length) {
    console.error(`informe ao menos um --origem\n\n${AJUDA}`);
    return 1;
  }
  const r = await executarCarga({
    origens: args.origens,
    anexos: args.anexos,
    encoding: args.encoding,
    simular: args.simular,
    confirmar: args.confirmar,
    relatorio: args.relatorio,
  });
  (r.codigo === 1 ? console.error : console.log)(r.resumo);
  return r.codigo;
}

main()
  .then(async (codigo) => {
    await prisma.$disconnect();
    process.exit(codigo);
  })
  .catch(async (error) => {
    console.error(`erro inesperado: ${(error as Error).message}`);
    await prisma.$disconnect();
    process.exit(1);
  });
