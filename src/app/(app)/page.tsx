import Link from "next/link";
import { Banknote, FilePlus2, Gavel } from "lucide-react";
import { contratosVencendoAte, type ContratoVencendo } from "@/lib/entities/contratos.server";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { formatCurrency, formatDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const JANELA_VENCENDO = 30;
const JANELA_VENCIDOS = 90;
const LIMITE = 10;

type Linha = ContratoVencendo;

function saudacao(hora: number) {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function prazo(dias: number) {
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Amanhã";
  if (dias > 1) return `Em ${dias} dias`;
  if (dias === -1) return "Há 1 dia";
  return `Há ${-dias} dias`;
}

export default async function Home() {
  const user = await getSessionUser();
  const now = new Date();
  // Vencimentos são gravados à meia-noite UTC do dia: compara pelo dia do servidor (como a lista).
  const hoje = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  // Vigência só pela data do próprio contrato (diretiva do autor 13/11/2026).
  // 023-perfis-acesso: o painel só lista contratos para quem pode listá-los; atalhos conforme `criar`.
  const verContratos = can(user, "contratos", "listar");
  const atalhos = {
    contrato: can(user, "contratos", "criar"),
    pagamento: can(user, "pagamentos", "criar"),
    penalidade: can(user, "penalidades", "criar"),
  };
  const linhas = verContratos ? await contratosVencendoAte(new Date(hoje + JANELA_VENCENDO * DAY), hoje) : [];
  const vencendo = linhas.filter((l) => l.dias >= 0).sort((a, b) => a.dias - b.dias);
  const vencidos = linhas.filter((l) => l.dias < 0 && l.dias >= -JANELA_VENCIDOS).sort((a, b) => b.dias - a.dias);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {saudacao(now.getHours())}
            {user ? `, ${user.username}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Hoje é <span className="tabular-nums">{formatDate(new Date(hoje))}</span>.{" "}
            {!verContratos
              ? "Use o menu ao lado para abrir o que o seu perfil permite."
              : vencendo.length === 0
                ? "Nenhum contrato vence nos próximos 30 dias."
                : vencendo.length === 1
                  ? "1 contrato vence nos próximos 30 dias."
                  : `${vencendo.length} contratos vencem nos próximos 30 dias.`}
          </p>
        </div>
        {(atalhos.contrato || atalhos.pagamento || atalhos.penalidade) && (
          <nav aria-label="Atalhos" className="flex flex-wrap gap-2">
            {atalhos.contrato && (
              <Link href="/contratos/new" className={cn(buttonVariants())}>
                <FilePlus2 aria-hidden />
                Novo contrato
              </Link>
            )}
            {atalhos.pagamento && (
              <Link href="/pagamentos/new" className={cn(buttonVariants({ variant: atalhos.contrato ? "outline" : "default" }))}>
                <Banknote aria-hidden />
                Novo pagamento
              </Link>
            )}
            {atalhos.penalidade && (
              <Link href="/penalidades/new" className={cn(buttonVariants({ variant: "outline" }))}>
                <Gavel aria-hidden />
                Registrar penalidade
              </Link>
            )}
          </nav>
        )}
      </header>

      {verContratos && (
        <>
          <Secao
            id="vencendo"
            titulo="Vencendo nos próximos 30 dias"
            descricao="Contratos cujo vencimento (data do próprio contrato) cai nos próximos 30 dias."
            linhas={vencendo}
            vazio="Nenhum contrato vence nos próximos 30 dias."
            tom="vencendo"
            link
          />
          <Secao
            id="vencidos"
            titulo="Vencidos"
            descricao={`Vencimento nos últimos ${JANELA_VENCIDOS} dias.`}
            linhas={vencidos}
            vazio={`Nenhum contrato venceu nos últimos ${JANELA_VENCIDOS} dias.`}
            tom="vencido"
          />
        </>
      )}
    </div>
  );
}

function Secao({
  id,
  titulo,
  descricao,
  linhas,
  vazio,
  tom,
  link = false,
}: {
  id: string;
  titulo: string;
  descricao: string;
  linhas: Linha[];
  vazio: string;
  tom: "vencendo" | "vencido";
  link?: boolean;
}) {
  const visiveis = linhas.slice(0, LIMITE);
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="space-y-0.5">
          <h2 id={`${id}-titulo`} className="flex items-baseline gap-2 text-base font-semibold">
            {titulo}
            <span className="text-sm font-normal text-muted-foreground tabular-nums">{linhas.length}</span>
          </h2>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        {link && (
          <Link href="/contratos" className="shrink-0 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline">
            Ver todos os contratos
          </Link>
        )}
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs whitespace-nowrap text-muted-foreground">
              <tr>
                <th scope="col" className="h-9 px-3 font-medium">
                  Nº do contrato
                </th>
                <th scope="col" className="h-9 px-3 font-medium">
                  Objeto
                </th>
                <th scope="col" className="hidden h-9 px-3 font-medium lg:table-cell">
                  Fornecedor
                </th>
                <th scope="col" className="h-9 px-3 font-medium">
                  Vencimento
                </th>
                <th scope="col" className="h-9 px-3 font-medium">
                  Prazo
                </th>
                <th scope="col" className="h-9 px-3 text-right font-medium">
                  Valor total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visiveis.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link
                      href={`/contratos/${l.id}`}
                      className="rounded-sm font-medium tabular-nums underline-offset-4 hover:text-primary hover:underline"
                    >
                      {l.numeroContrato ?? `#${l.id}`}
                    </Link>
                  </td>
                  <td className="max-w-80 truncate px-3 py-2.5" title={l.objeto}>
                    {l.objeto}
                  </td>
                  <td className="hidden max-w-64 truncate px-3 py-2.5 text-muted-foreground lg:table-cell">{l.fornecedor ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{formatDate(l.vencimento)}</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 whitespace-nowrap tabular-nums",
                      tom === "vencido" ? "text-destructive" : l.dias <= 7 ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {prazo(l.dias)}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatCurrency(l.valorTotal) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {linhas.length > LIMITE && (
        <p className="text-sm text-muted-foreground">
          Mostrando {LIMITE} de <span className="tabular-nums">{linhas.length}</span>.
        </p>
      )}
    </section>
  );
}
