import Link from "next/link";
import { AvisoSemTipoContrato, ReportPage, ResultadoTitulo, contratos } from "@/components/relatorios/report-page";
import { ReportTable, traco, type ColunaTabela } from "@/components/relatorios/report-table";
import { SEM_TIPO_CONTRATO } from "@/lib/relatorios/comum";
import { consultar, type LinhaCadastro } from "@/lib/relatorios/cadastro-incompleto";
import { cn } from "@/lib/utils";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

function SimNao({ sim }: { sim: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
        sim ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive",
      )}
    >
      {sim ? "Sim" : "Não"}
    </span>
  );
}

const COLUNAS: ColunaTabela<LinhaCadastro>[] = [
  { label: "Nº processo", render: (l) => traco(l.processo), className: "tabular-nums" },
  {
    label: "Nº contrato",
    render: (l) => (
      <Link href={`/contratos/${l.id}`} className="font-medium tabular-nums underline-offset-4 hover:text-primary hover:underline">
        {l.contrato || `#${l.id}`}
      </Link>
    ),
  },
  { label: "Contratada", render: (l) => traco(l.contratada), className: "max-w-[16rem] whitespace-normal!" },
  { label: "Objeto", render: (l) => l.objeto, longa: true },
  { label: "Tem contrato", render: (l) => <SimNao sim={l.temContrato} /> },
  { label: "Tem projeto básico", render: (l) => <SimNao sim={l.temProjetoBasico} /> },
];

/** Cadastro incompleto (019-relatorios; docs/legado/relatorios.md, tela `cadastro`). Sem filtros, só tela. */
export default async function CadastroIncompletoPage() {
  // 023-perfis-acesso: a tela exige `relatorios:listar`.
  const user = await guardPage("relatorios", "listar");
  if (!user) return <SemPermissao />;
  const resultado = await consultar();
  const semTipo = resultado.avisos?.includes(SEM_TIPO_CONTRATO);
  return (
    <ReportPage
      titulo="Cadastro incompleto"
      descricao="Contratos originais do tipo Contrato, vigentes, sem o PDF do contrato ou sem o PDF do projeto básico."
    >
      {semTipo ? (
        <AvisoSemTipoContrato />
      ) : (
        <section aria-label="Resultado" className="flex flex-col gap-3">
          <ResultadoTitulo titulo="Contratos com cadastro incompleto" contagem={contratos(resultado.linhas.length)} />
          <ReportTable caption="Contratos com cadastro incompleto" colunas={COLUNAS} linhas={resultado.linhas} chave={(l) => l.id} />
        </section>
      )}
    </ReportPage>
  );
}
