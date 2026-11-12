import { notFound } from "next/navigation";
import { NAV_ITEMS, findNavItem } from "@/lib/navigation";

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
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{item.label}</h1>
      <p className="text-muted-foreground">
        A lista de {item.label.toLowerCase()} chega com a change <code>{item.change}</code>.
      </p>
    </div>
  );
}
