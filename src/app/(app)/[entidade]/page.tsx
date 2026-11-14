import { notFound } from "next/navigation";
import { NAV_ITEMS, findNavItem } from "@/lib/navigation";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";

/**
 * Rota provisória de cada entidade da navegação. Cada change de entidade cria a sua rota
 * estática (`src/app/<entidade>/page.tsx`), que tem precedência sobre esta.
 */
export function generateStaticParams() {
  return NAV_ITEMS.map((item) => ({ entidade: item.href.slice(1) }));
}

export default async function EntidadePendente({ params }: { params: Promise<{ entidade: string }> }) {
  const { entidade } = await params;
  const item = findNavItem(entidade);
  if (!item) notFound();
  if (!(await guardPage(item.resource, "listar"))) return <SemPermissao />; // 023-perfis-acesso
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{item.label}</h1>
      <p className="text-muted-foreground">
        A lista de {item.label.toLowerCase()} chega com a change <code>{item.change}</code>.
      </p>
    </div>
  );
}
