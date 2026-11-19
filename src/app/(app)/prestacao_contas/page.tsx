import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { PrestacaoLista } from "./prestacao-lista";

/** Prestação de contas › Pendentes / Realizadas (021-prestacao-contas-fluxo). A aba fica em `?situacao=`. */
export default async function PrestacaoContasPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  if (!(await guardPage("prestacao_contas", "listar"))) return <SemPermissao />; // 023-perfis-acesso
  const { situacao } = await searchParams;
  return <PrestacaoLista situacaoInicial={situacao === "realizadas" ? "realizadas" : "pendentes"} />;
}
