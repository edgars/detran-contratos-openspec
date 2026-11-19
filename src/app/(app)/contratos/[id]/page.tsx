import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangleIcon, CalendarCheckIcon, CalendarClockIcon, CalendarXIcon, FileTextIcon, PencilIcon, PlusIcon } from "lucide-react";
import { AndamentoForm } from "@/components/contratos/andamento-form";
import { PrintButton } from "@/components/contratos/print-button";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { formatDataHora } from "@/lib/contratos/data-hora";
import { vigencia, type EstadoVigencia, type Tom } from "@/lib/contratos/vigencia";
import { getContratoDetalhe, getContratoResumoDetalhe, type Andamento } from "@/lib/entities/contratos.server";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EMPTY = "—";
const text = (v: unknown) => (v === null || v === undefined || v === "" ? EMPTY : String(v));
const money = (v: { toString(): string } | null) => (v === null ? EMPTY : formatCurrency(v) || EMPTY);
const date = (v: Date | string | null) => formatDate(v) || EMPTY;

const TONS: Record<Tom, string> = {
  neutro: "border-border bg-muted text-foreground",
  ok: "border-border bg-background text-foreground [&_svg]:text-primary",
  alerta: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  erro: "border-destructive/30 bg-destructive/10 text-destructive",
};

function Selo({ tom, icon: Icon, children }: { tom: Tom; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium whitespace-nowrap tabular-nums",
        TONS[tom],
      )}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}

const ICONES: Record<EstadoVigencia, React.ElementType> = {
  "a-iniciar": CalendarClockIcon,
  vigente: CalendarCheckIcon,
  vencendo: AlertTriangleIcon,
  "vence-hoje": AlertTriangleIcon,
  vencido: CalendarXIcon,
};

function PdfLink({ nome, label = "Ver PDF" }: { nome: string | null; label?: string }) {
  if (!nome) return <span className="text-muted-foreground">{EMPTY}</span>;
  return (
    <a
      className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      href={`/api/arquivos/${nome}`}
      target="_blank"
      rel="noreferrer"
    >
      <FileTextIcon aria-hidden className="size-4" />
      {label}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

const NAO_ENCONTRADO = " (não encontrado em pessoas físicas)";

/** "Nome — documento" com o documento discreto; CPF órfão com o aviso em destaque (o texto lido é o rótulo inteiro). */
function parte(rotulo: string | null): React.ReactNode {
  if (!rotulo) return EMPTY;
  if (rotulo.endsWith(NAO_ENCONTRADO)) {
    return (
      <>
        <span className="tabular-nums">{rotulo.slice(0, -NAO_ENCONTRADO.length)}</span>
        <span className="font-normal text-amber-800 dark:text-amber-300">{NAO_ENCONTRADO}</span>
      </>
    );
  }
  const corte = rotulo.lastIndexOf(" — ");
  if (corte < 0) return rotulo;
  return (
    <>
      {rotulo.slice(0, corte)}
      <span className="font-normal text-muted-foreground tabular-nums">{rotulo.slice(corte)}</span>
    </>
  );
}

type Item = { label: string; value: React.ReactNode; wide?: boolean; numeric?: boolean };

function Secao({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t pt-6 print:break-inside-avoid">
      <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Dados({ items }: { items: Item[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:gap-x-8 lg:grid-cols-3">
      {items.map(({ label, value, wide, numeric }) => (
        <div key={label} className={cn("min-w-0", wide && "col-span-2 lg:col-span-3")}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className={cn("mt-0.5 text-sm font-medium break-words whitespace-pre-wrap", numeric && "tabular-nums")}>
            {value === EMPTY ? <span className="font-normal text-muted-foreground">{EMPTY}</span> : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Detalhe do contrato (017-contratos): dados, anexos e aditivos, com o botão Novo aditivo.
 * 023-perfis-acesso: com `contratos:ver`, a página completa (ações conforme as permissões); só com
 * `contratos_resumo:ver` (Consulta), a visão restrita — sem anexos, andamento, Editar nem Novo aditivo.
 */
export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const user = await guardPage("contratos", "ver", ["contratos_resumo", "ver"]);
  if (!user) return <SemPermissao />;
  const id = /^\d+$/.test(raw) ? Number(raw) : null;
  const completo = can(user, "contratos", "ver");
  // Visão restrita: só a projeção é lida do banco (getContratoResumoDetalhe).
  const extra = id && completo ? await getContratoDetalhe(id) : null;
  const detalhe = extra ?? (id && !completo ? await getContratoResumoDetalhe(id) : null);
  if (!detalhe) notFound();
  const { contrato: c, gestor, suplente, fornecedor } = detalhe;
  const pode = {
    editar: completo && can(user, "contratos", "editar"),
    aditivo: completo && can(user, "contratos", "criar"),
    imprimir: completo,
    andamento: Boolean(extra) && can(user, "contrato_status", "listar"),
    registrarAndamento: Boolean(extra) && can(user, "contrato_status", "criar"),
    publicacoes: can(user, "anexos_publicacaos", "ver"),
    fiscais: can(user, "anexos_fiscais", "ver"),
  };

  const ehAditivo = Boolean(c.parentId);
  // Vigência só pela data do próprio contrato (diretiva do autor 13/11/2026): aditivos têm as próprias datas.
  const selo = vigencia(c.dataInicio, c.dataTermino);

  const identificacao: Item[] = [
    { label: "Nº do contrato", value: text(c.numeroContrato), numeric: true },
    { label: "Nº do processo", value: text(c.numeroProcesso), numeric: true },
    { label: "Tipo de contrato", value: text(c.tipoContrato?.nome) },
    { label: "Modalidade", value: text(c.modalidade?.nome) },
    { label: "Nº da modalidade", value: text(c.numeroModalidade), numeric: true },
    { label: "Situação contratual", value: text(c.situacaoContratual?.descricao) },
    ...(extra ? [{ label: "Data de inclusão", value: date(extra.contrato.dataInclusao), numeric: true }] : []),
  ];
  const partes: Item[] = [
    { label: "Unidade gestora", value: text(c.departamento?.deDepartamento) },
    // "Nome — documento" (022-pessoas-fornecedores, D10); CPF sem pessoa aparece com o aviso.
    { label: "Fornecedor", value: parte(fornecedor) },
    { label: "Gestor", value: parte(gestor) },
    { label: "Gestor suplente", value: parte(suplente) },
    ...(extra
      ? [
          { label: "Número de fiscais", value: text(extra.contrato.numeroFiscais), numeric: true },
          { label: "Localizado na Presidência", value: extra.contrato.naPresidencia === 1 ? "Sim" : "Não" },
        ]
      : []),
  ];
  const valores: Item[] = [
    { label: "Data de início", value: date(c.dataInicio), numeric: true },
    { label: "Data de vencimento", value: date(c.dataTermino), numeric: true },
    { label: "Valor mensal", value: money(c.valorMensal), numeric: true },
    { label: "Valor total", value: money(c.valorTotal), numeric: true },
    { label: "Valor inicial", value: money(c.valorInicial), numeric: true },
  ];

  const novoAditivo = (
    <Link className={cn(buttonVariants())} href={`/contratos/${c.id}/aditivos/new`}>
      <PlusIcon aria-hidden data-icon="inline-start" />
      Novo aditivo
    </Link>
  );

  return (
    <div className="max-w-5xl space-y-8 print:max-w-none print:space-y-6">
      {/* Cabeçalho só da impressão (020): não aparece na tela. */}
      <div className="hidden border-b pb-3 print:block">
        <p className="text-base font-semibold tabular-nums">DETRAN-RJ — Contrato nº {text(c.numeroContrato)}</p>
        <p className="text-sm tabular-nums">
          Impresso em {formatDataHora(new Date())} por {user.username}
        </p>
      </div>
      <header>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance tabular-nums">
              {ehAditivo
                ? `Aditivo do contrato ${text(c.parent?.numeroContrato ?? c.numeroContrato)}`
                : `Contrato ${text(c.numeroContrato)}`}
            </h1>
            {c.objeto && <p className="max-w-prose text-sm text-pretty text-muted-foreground">{c.objeto}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {c.situacaoContratual?.descricao && <Selo tom="neutro">{c.situacaoContratual.descricao}</Selo>}
              {selo && (
                <Selo tom={selo.tom} icon={ICONES[selo.estado]}>
                  {selo.texto}
                </Selo>
              )}
              {c.dataTermino && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Vigência {date(c.dataInicio)} a {date(c.dataTermino)}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 print:hidden">
            {c.parent && (
              <Link className={cn(buttonVariants({ variant: "outline" }))} href={`/contratos/${c.parent.id}`}>
                Contrato original
              </Link>
            )}
            {pode.editar && (
              <Link className={cn(buttonVariants({ variant: "outline" }))} href={`/contratos/${c.id}/edit`}>
                <PencilIcon aria-hidden data-icon="inline-start" />
                Editar
              </Link>
            )}
            {pode.imprimir && <PrintButton />}
            {pode.aditivo && novoAditivo}
          </div>
        </div>
      </header>

      <Secao id="sec-identificacao" title="Identificação">
        <Dados items={identificacao} />
      </Secao>

      <Secao id="sec-partes" title="Partes e responsáveis">
        <Dados items={partes} />
      </Secao>

      <Secao id="sec-vigencia" title="Vigência e valores">
        <Dados items={valores} />
      </Secao>

      <Secao id="sec-aditivos" title={c.aditivos.length ? `Aditivos (${c.aditivos.length})` : "Aditivos"}>
        {c.aditivos.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {pode.aditivo
                ? "Nenhum aditivo registrado. Use Novo aditivo para prorrogar a vigência ou alterar valores."
                : "Nenhum aditivo registrado."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aditivo</TableHead>
                <TableHead>Data de início</TableHead>
                <TableHead>Data de vencimento</TableHead>
                <TableHead className="text-right">Valor mensal</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {c.aditivos.map((a, i) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link
                      className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      href={`/contratos/${a.id}`}
                    >
                      {i + 1}º aditivo
                    </Link>
                  </TableCell>
                  <TableCell>{date(a.dataInicio)}</TableCell>
                  <TableCell>{date(a.dataTermino)}</TableCell>
                  <TableCell className="text-right">{money(a.valorMensal)}</TableCell>
                  <TableCell className="text-right">{money(a.valorTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Secao>

      {extra && (
        <Secao id="sec-anexos" title="Anexos">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <h3 className="text-sm text-muted-foreground">Contrato</h3>
              <div className="mt-1.5 text-sm">
                <PdfLink nome={extra.contrato.anexo} />
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm text-muted-foreground">Projeto básico</h3>
              <div className="mt-1.5 text-sm">
                <PdfLink nome={extra.contrato.projetoBasico} />
              </div>
            </div>
            {pode.publicacoes && (
              <AnexoLista
                titulo="Publicação"
                itens={extra.publicacoes.map((a) => ({ id: a.id, data: a.dataPublicacao, anexo: a.anexo }))}
              />
            )}
            {pode.fiscais && (
              <AnexoLista
                titulo="Relatório fiscal"
                itens={extra.fiscais.map((a) => ({ id: a.id, data: a.dataRegistro, anexo: a.anexo }))}
              />
            )}
          </div>
        </Secao>
      )}

      {extra && pode.andamento && (
        <Secao id="sec-andamento" title={extra.andamentos.length ? `Andamento (${extra.andamentos.length})` : "Andamento"}>
          <div className="space-y-6">
            {pode.registrarAndamento && <AndamentoForm contratoId={c.id} />}
            <LinhaDoTempo itens={extra.andamentos} />
          </div>
        </Secao>
      )}
    </div>
  );
}

/** Linha do tempo do andamento (020): do mais recente para o mais antigo. */
function LinhaDoTempo({ itens }: { itens: Andamento[] }) {
  if (itens.length === 0) return <p className="text-sm text-muted-foreground">Nenhum andamento registrado.</p>;
  return (
    <ol aria-label="Linha do tempo do andamento" className="relative ml-1.5 space-y-5 border-l pl-5 print:space-y-3">
      {itens.map((a) => (
        <li key={a.id} className="relative print:break-inside-avoid">
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 -left-[1.6875rem] size-2.5 rounded-full ring-4 ring-background",
              a.atendido ? "bg-primary" : "bg-amber-500",
            )}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium">{a.status ?? "Status removido"}</span>
            <Selo tom={a.atendido ? "ok" : "alerta"}>{a.atendido ? "Atendido" : "Pendente"}</Selo>
          </div>
          {a.descricao && <p className="mt-1 max-w-prose text-sm text-pretty whitespace-pre-wrap">{a.descricao}</p>}
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {formatDataHora(a.dataInclusao) || EMPTY}
            {a.usuario ? ` · ${a.usuario}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

function AnexoLista({ titulo, itens }: { titulo: string; itens: { id: number; data: Date | string | null; anexo: string | null }[] }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm text-muted-foreground">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">Nenhum anexo.</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5 text-sm">
          {itens.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="tabular-nums">{date(a.data)}</span>
              <PdfLink nome={a.anexo} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
