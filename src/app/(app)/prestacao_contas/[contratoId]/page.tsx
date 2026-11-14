import { notFound } from "next/navigation";
import { FluxoPrestacao, type FluxoData } from "@/components/prestacao/fluxo";
import { getFluxo } from "@/lib/prestacao/server";

export const dynamic = "force-dynamic";

/** Fluxo de prestação de contas de um contrato (021-prestacao-contas-fluxo). O prazo fica em `?periodo=`. */
export default async function FluxoPrestacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ contratoId: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { contratoId } = await params;
  const { periodo } = await searchParams;
  const id = /^\d+$/.test(contratoId) ? Number(contratoId) : null;
  const fluxo = id ? await getFluxo(id, periodo ?? null) : null;
  if (!fluxo) notFound();
  // Datas e Decimal viram texto, como na resposta da API.
  const data = JSON.parse(JSON.stringify(fluxo)) as FluxoData;
  return <FluxoPrestacao data={data} />;
}
