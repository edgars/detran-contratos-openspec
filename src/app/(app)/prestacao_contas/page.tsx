import { PrestacaoLista } from "./prestacao-lista";

/** Prestação de contas › Pendentes / Realizadas (021-prestacao-contas-fluxo). A aba fica em `?situacao=`. */
export default async function PrestacaoContasPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const { situacao } = await searchParams;
  return <PrestacaoLista situacaoInicial={situacao === "realizadas" ? "realizadas" : "pendentes"} />;
}
