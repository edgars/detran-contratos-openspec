import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RELATORIOS } from "@/lib/relatorios/indice";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  // 023-perfis-acesso: índice com `relatorios:listar`; "Acerto de valor" só para quem tem `acerto_valor:listar`.
  const user = await guardPage("relatorios", "listar");
  if (!user) return <SemPermissao />;
  const relatorios = RELATORIOS.filter((r) => r.href !== "/relatorios/acerto-valor" || can(user, "acerto_valor", "listar"));
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Relatórios</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Relatórios gerenciais dos contratos originais. O vencimento considera só a data de término do próprio contrato, sem aditivos.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {relatorios.map((r) => (
          <li key={r.href} className="flex">
            <Card className="group/rel relative flex-1 transition-colors hover:bg-muted/40 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
              <CardHeader className="gap-1.5">
                <CardTitle>
                  <Link href={r.href} className="outline-none after:absolute after:inset-0 after:content-['']">
                    {r.titulo}
                  </Link>
                </CardTitle>
                <CardDescription className="text-pretty">{r.descricao}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto justify-between border-t bg-transparent pt-3 text-xs text-muted-foreground">
                <span>{r.saidas}</span>
                <ArrowRight
                  className="size-4 transition-transform group-hover/rel:translate-x-0.5 group-hover/rel:text-foreground"
                  aria-hidden
                />
              </CardFooter>
            </Card>
          </li>
        ))}
      </ul>

      {can(user, "relatorios", "exportar") && (
        <p className="flex max-w-3xl items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Para salvar em PDF, use <span className="font-medium text-foreground">Imprimir / PDF</span> no relatório e escolha “Salvar como
            PDF” no destino. Desmarque “Cabeçalhos e rodapés” nas opções da impressão para o papel sair só com o relatório.
          </span>
        </p>
      )}
    </div>
  );
}
