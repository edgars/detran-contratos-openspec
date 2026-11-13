import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getContratoDetalhe } from "@/lib/entities/contratos.server";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const text = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const money = (v: { toString(): string } | null) => (v === null ? "—" : formatCurrency(v));
const pdf = (nome: string | null) =>
  nome ? (
    <a className="underline" href={`/api/arquivos/${nome}`} target="_blank" rel="noreferrer">
      PDF
    </a>
  ) : (
    "—"
  );

/** Detalhe do contrato (017-contratos): dados, anexos e aditivos, com o botão Novo aditivo. */
export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = /^\d+$/.test(raw) ? Number(raw) : null;
  const detalhe = id ? await getContratoDetalhe(id) : null;
  if (!detalhe) notFound();
  const { contrato: c, gestor, suplente, publicacoes, fiscais } = detalhe;

  const dados: [string, React.ReactNode][] = [
    ["Nº do processo", text(c.numeroProcesso)],
    ["Nº do contrato", text(c.numeroContrato)],
    ["Tipo de contrato", text(c.tipoContrato?.nome)],
    ["Modalidade", text(c.modalidade?.nome)],
    ["Nº da modalidade", text(c.numeroModalidade)],
    ["Objeto", text(c.objeto)],
    ["Unidade gestora", text(c.departamento?.deDepartamento)],
    ["Fornecedor", text(c.prestadorServico?.deRazaoSocial)],
    ["Gestor", text(gestor ?? c.pessoaFisicaId)],
    ["Gestor suplente", text(suplente ?? c.suplenteId)],
    ["Data de início", text(formatDate(c.dataInicio))],
    ["Data de vencimento", text(formatDate(c.dataTermino))],
    ["Valor mensal", money(c.valorMensal)],
    ["Valor total", money(c.valorTotal)],
    ["Valor inicial", money(c.valorInicial)],
    ["Situação contratual", text(c.situacaoContratual?.descricao)],
    ["Projeto básico", text(c.projetoBasico)],
    ["Contrato (PDF)", pdf(c.anexo)],
    ["Data de inclusão", text(formatDate(c.dataInclusao))],
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">
          {c.parentId ? "Aditivo" : "Contrato"} {text(c.numeroContrato)}
        </h1>
        {c.parent && (
          <Link className={buttonVariants({ variant: "outline" })} href={`/contratos/${c.parent.id}`}>
            Contrato original
          </Link>
        )}
        <Link className={buttonVariants({ variant: "outline" })} href={`/contratos/${c.id}/edit`}>
          Editar
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/contratos">
          Voltar
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do contrato</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {dados.map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="whitespace-pre-wrap">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aditivos</CardTitle>
          <CardAction>
            <Link className={buttonVariants()} href={`/contratos/${c.id}/aditivos/new`}>
              Novo aditivo
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data de início</TableHead>
                <TableHead>Data de vencimento</TableHead>
                <TableHead>Valor mensal</TableHead>
                <TableHead>Valor total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.aditivos.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link className="font-medium underline-offset-4 hover:underline" href={`/contratos/${a.id}`}>
                      {text(formatDate(a.dataInicio))}
                    </Link>
                  </TableCell>
                  <TableCell>{text(formatDate(a.dataTermino))}</TableCell>
                  <TableCell>{money(a.valorMensal)}</TableCell>
                  <TableCell>{money(a.valorTotal)}</TableCell>
                </TableRow>
              ))}
              {c.aditivos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum aditivo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anexos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-medium">Publicação</h2>
            <ul className="space-y-1 text-sm">
              {publicacoes.map((a) => (
                <li key={a.id}>
                  {formatDate(a.dataPublicacao)} — {pdf(a.anexo)}
                </li>
              ))}
              {publicacoes.length === 0 && <li className="text-muted-foreground">Nenhum anexo.</li>}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium">Relatório fiscal</h2>
            <ul className="space-y-1 text-sm">
              {fiscais.map((a) => (
                <li key={a.id}>
                  {formatDate(a.dataRegistro)} — {pdf(a.anexo)}
                </li>
              ))}
              {fiscais.length === 0 && <li className="text-muted-foreground">Nenhum anexo.</li>}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
