"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarXIcon, CheckCircle2Icon, CircleDashedIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { BreadcrumbOverride } from "@/components/shell/app-breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Usuario = { id: number; username: string } | null;
type Registro = { id: number; descricao: string | null; atendido: string | null; dataInclusao: string | null; usuario: Usuario };

/** Resposta de `GET /api/prestacao_contas/contratos/:id` (datas e Decimal em texto). */
export type FluxoData = {
  contrato: {
    id: number;
    numeroProcesso: string | null;
    numeroContrato: string | null;
    objeto: string;
    dataInicio: string | null;
    dataTermino: string | null;
    valorTotal: string | null;
    prestacaoRealizada: string | null;
    departamento: { id: number; deDepartamento: string | null } | null;
    prestadorServico: { id: number; deRazaoSocial: string | null } | null;
    tipoContrato: { id: number; nome: string | null } | null;
    modalidade: { id: number; nome: string | null } | null;
  };
  diasDesdeVencimento: number | null;
  mesesDesdeInicio: number | null;
  realizada: boolean;
  prazos: string[];
  periodo: string | null;
  fases: { id: number; nome: string; periodo: string; ultimo: Registro | null }[];
  historico: (Omit<Registro, "id"> & { id: number; fase: { id: number; nome: string; periodo: string } | null })[];
};

const EMPTY = "—";
const text = (v: string | null | undefined) => (v ? v : EMPTY);
const nf = new Intl.NumberFormat("pt-BR");
const prazoLabel = (p: string) => (/^\d+$/.test(p) ? `${p} dias` : p);
const dias = (n: number) => `${nf.format(n)} ${Math.abs(n) === 1 ? "dia" : "dias"}`;
const meses = (n: number) => `${nf.format(n)} ${Math.abs(n) === 1 ? "mês" : "meses"}`;

function vencimentoTexto(n: number | null) {
  if (n === null) return EMPTY;
  if (n > 0) return `Vencido há ${dias(n)}`;
  if (n === 0) return "Vence hoje";
  return `Vence em ${dias(-n)}`;
}

function Selo({ realizada }: { realizada: boolean }) {
  const Icon = realizada ? CheckCircle2Icon : CircleDashedIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        realizada ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-800 dark:text-amber-300",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {realizada ? "Realizada" : "Pendente"}
    </span>
  );
}

function Dado({ label, children, numeric, wide }: { label: string; children: React.ReactNode; numeric?: boolean; wide?: boolean }) {
  const vazio = children === EMPTY;
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm font-medium break-words", numeric && "tabular-nums", vazio && "font-normal text-muted-foreground")}>{children}</dd>
    </div>
  );
}

function Secao({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex min-h-8 flex-wrap items-end justify-between gap-3">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Linha de uma fase: descrição, atendido e Gravar (sempre cria um registro novo). */
function FaseLinha({
  contratoId,
  fase,
  onSaved,
  podeGravar,
}: {
  contratoId: number;
  fase: FluxoData["fases"][number];
  onSaved: (concluiu: boolean) => void;
  podeGravar: boolean;
}) {
  const id = useId();
  const [descricao, setDescricao] = useState(fase.ultimo?.descricao ?? "");
  const [atendido, setAtendido] = useState(fase.ultimo?.atendido === "S");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const gravar = async () => {
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch("/api/prestacao_contas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contratoId, faseId: fase.id, descricao, atendido: atendido ? "S" : "N" }),
      });
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { errors?: Record<string, string> };
        setErrors(body.errors ?? { _: "Não foi possível gravar a fase." });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      onSaved(fase.periodo === "30" && atendido);
    } catch {
      toast.error("Não foi possível gravar a fase. Verifique a conexão e tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const erro = Object.values(errors)[0];
  const gravada = (
    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
      {fase.ultimo
        ? `Gravada em ${formatDate(fase.ultimo.dataInclusao) || EMPTY}${fase.ultimo.usuario ? ` por ${fase.ultimo.usuario.username}` : ""}`
        : "Ainda não gravada"}
    </p>
  );
  if (!podeGravar) {
    // 023-perfis-acesso: sem `prestacao_contas:criar` (Fiscal, Financeiro), a fase só é consultada.
    return (
      <TableRow className="align-top hover:bg-transparent">
        <TableCell className="min-w-44 px-3 py-3 whitespace-normal">
          <p className="font-medium">{fase.nome}</p>
          {gravada}
        </TableCell>
        <TableCell className="min-w-56 px-3 py-3 whitespace-pre-wrap sm:min-w-64">
          {fase.ultimo?.descricao || <span className="text-muted-foreground">{EMPTY}</span>}
        </TableCell>
        <TableCell className="px-3 py-3">{fase.ultimo ? (fase.ultimo.atendido === "S" ? "Sim" : "Não") : EMPTY}</TableCell>
      </TableRow>
    );
  }
  return (
    <TableRow className="align-top hover:bg-transparent">
      <TableCell className="min-w-44 px-3 py-3 whitespace-normal">
        <p className="font-medium">{fase.nome}</p>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {fase.ultimo
            ? `Gravada em ${formatDate(fase.ultimo.dataInclusao) || EMPTY}${fase.ultimo.usuario ? ` por ${fase.ultimo.usuario.username}` : ""}`
            : "Ainda não gravada"}
        </p>
      </TableCell>
      <TableCell className="min-w-56 px-3 py-3 whitespace-normal sm:min-w-64">
        <label htmlFor={`${id}-d`} className="sr-only">
          Descrição da fase {fase.nome}
        </label>
        <Textarea
          id={`${id}-d`}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          className="min-h-16"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-e` : undefined}
        />
        {erro && (
          <p id={`${id}-e`} role="alert" className="mt-1.5 text-sm text-destructive">
            {erro}
          </p>
        )}
      </TableCell>
      <TableCell className="px-3 py-3">
        <div className="flex h-8 items-center gap-2">
          <Switch id={`${id}-a`} checked={atendido} onCheckedChange={(c) => setAtendido(Boolean(c))} aria-label={`Atendido: ${fase.nome}`} />
          <span className="text-sm text-muted-foreground" aria-hidden>
            {atendido ? "Sim" : "Não"}
          </span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 text-right">
        <Button variant="outline" onClick={() => void gravar()} disabled={saving}>
          {saving && <Loader2Icon data-icon="inline-start" aria-hidden className="animate-spin" />}
          Gravar
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** Fluxo de prestação de contas: painel, prazo, fases do prazo e histórico (021-prestacao-contas-fluxo). */
export function FluxoPrestacao({ data, podeGravar = true }: { data: FluxoData; podeGravar?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const c = data.contrato;
  const titulo = `Contrato ${c.numeroContrato ?? `#${c.id}`}`;

  const escolherPrazo = (p: string) => {
    startTransition(() => router.replace(`/prestacao_contas/${c.id}?periodo=${encodeURIComponent(p)}`, { scroll: false }));
  };

  const onSaved = (concluiu: boolean) => {
    if (concluiu && !data.realizada) toast.success("Fase gravada. Prestação de contas concluída: o contrato passou para Realizadas.");
    else toast.success("Fase gravada.");
    startTransition(() => router.refresh());
  };

  return (
    <div className="max-w-5xl space-y-8">
      <BreadcrumbOverride pathname={`/prestacao_contas/${c.id}`} last={titulo} />
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance tabular-nums">{titulo}</h1>
          {c.objeto && <p className="max-w-prose text-sm text-pretty text-muted-foreground">{c.objeto}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Selo realizada={data.realizada} />
            {data.diasDesdeVencimento !== null && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <CalendarXIcon aria-hidden className="size-3.5" />
                {vencimentoTexto(data.diasDesdeVencimento)}
              </span>
            )}
          </div>
        </div>
        <Link className={cn(buttonVariants({ variant: "outline" }), "shrink-0")} href={`/contratos/${c.id}`}>
          <ExternalLinkIcon data-icon="inline-start" aria-hidden />
          Ver contrato
        </Link>
      </header>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:gap-x-8 lg:grid-cols-4">
            <Dado label="Nº processo" numeric>
              {text(c.numeroProcesso)}
            </Dado>
            <Dado label="Nº contrato" numeric>
              {text(c.numeroContrato)}
            </Dado>
            <Dado label="Tipo de contrato">{text(c.tipoContrato?.nome)}</Dado>
            <Dado label="Valor total" numeric>
              {c.valorTotal ? formatCurrency(c.valorTotal) || EMPTY : EMPTY}
            </Dado>
            <Dado label="Contratada" wide>
              {text(c.prestadorServico?.deRazaoSocial)}
            </Dado>
            <Dado label="UN gestora" wide>
              {text(c.departamento?.deDepartamento)}
            </Dado>
            <Dado label="Vencimento" numeric>
              {formatDate(c.dataTermino) || EMPTY}
            </Dado>
            <Dado label="Dias desde o vencimento" numeric>
              {data.diasDesdeVencimento === null ? EMPTY : nf.format(data.diasDesdeVencimento)}
            </Dado>
            <Dado label="Início" numeric>
              {formatDate(c.dataInicio) || EMPTY}
            </Dado>
            <Dado label="Meses desde o início" numeric>
              {data.mesesDesdeInicio === null ? EMPTY : meses(data.mesesDesdeInicio)}
            </Dado>
          </dl>
        </CardContent>
      </Card>

      <Secao
        id="sec-fases"
        title="Fases do prazo"
        action={
          data.prazos.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="prazo" className="text-sm text-muted-foreground">
                Prazo
              </label>
              <Select
                items={data.prazos.map((p) => ({ value: p, label: prazoLabel(p) }))}
                value={data.periodo}
                onValueChange={(v) => v != null && escolherPrazo(String(v))}
              >
                <SelectTrigger id="prazo" className="h-8 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.prazos.map((p) => (
                    <SelectItem key={p} value={p}>
                      {prazoLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        }
      >
        {data.fases.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            {data.prazos.length === 0 ? (
              <>
                Nenhuma fase cadastrada. Cadastre as fases e seus prazos em{" "}
                <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/fases">
                  Fases
                </Link>
                .
              </>
            ) : (
              "Nenhuma fase neste prazo."
            )}
          </div>
        ) : (
          <div className={cn("overflow-hidden rounded-lg border [contain:inline-size] transition-opacity", pending && "opacity-60")}>
            <Table aria-busy={pending || undefined}>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 px-3 text-xs font-medium text-muted-foreground">Fase</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-medium text-muted-foreground">Descrição</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-medium text-muted-foreground">Atendido</TableHead>
                  {podeGravar && (
                    <TableHead className="h-9 px-3 text-xs font-medium text-muted-foreground">
                      <span className="sr-only">Ação</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.fases.map((f) => (
                  <FaseLinha key={`${f.id}-${f.ultimo?.id ?? 0}`} contratoId={c.id} fase={f} onSaved={onSaved} podeGravar={podeGravar} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {podeGravar && data.periodo === "30" && !data.realizada && (
          <p className="text-sm text-muted-foreground">Gravar uma fase deste prazo com Atendido ligado conclui a prestação de contas.</p>
        )}
      </Secao>

      <Secao id="sec-historico" title={data.historico.length ? `Histórico (${data.historico.length})` : "Histórico"}>
        {data.historico.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">Nenhuma fase gravada para este contrato.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border [contain:inline-size]">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 px-3 text-xs font-medium text-muted-foreground">Data</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-medium text-muted-foreground">Fase</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-medium text-muted-foreground">Descrição</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-medium text-muted-foreground">Atendido</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-medium text-muted-foreground">Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.historico.map((h) => (
                  <TableRow key={h.id} className="hover:bg-transparent">
                    <TableCell className="h-11 px-3 tabular-nums">{formatDate(h.dataInclusao) || EMPTY}</TableCell>
                    <TableCell className="px-3">
                      {h.fase ? (
                        <>
                          {h.fase.nome}
                          <span className="text-muted-foreground"> · {prazoLabel(h.fase.periodo)}</span>
                        </>
                      ) : (
                        EMPTY
                      )}
                    </TableCell>
                    <TableCell className="max-w-[24rem] px-3 whitespace-normal">
                      {h.descricao || <span className="text-muted-foreground">{EMPTY}</span>}
                    </TableCell>
                    <TableCell className="px-3">
                      {h.atendido === "S" ? (
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Sim</span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3">{h.usuario?.username ?? EMPTY}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Secao>
    </div>
  );
}
