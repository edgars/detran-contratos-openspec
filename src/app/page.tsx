import Link from "next/link";
import { NAV_ITEMS } from "@/lib/navigation";

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Gestão de contratos</h1>
      <p className="text-muted-foreground">Escolha um cadastro.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block rounded-lg border p-3 hover:bg-muted">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
