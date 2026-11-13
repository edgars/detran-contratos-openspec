import Link from "next/link";
import { EntityForm } from "@/components/crud/entity-form";
import { buttonVariants } from "@/components/ui/button";
import { contratos } from "@/lib/entities/contratos";

export default async function EditarContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`${contratos.basePath}/${id}`}>
        Ver contrato e aditivos
      </Link>
      <EntityForm title="Editar contrato" api={contratos.api} basePath={contratos.basePath} fields={contratos.fields} id={id} />
    </div>
  );
}
