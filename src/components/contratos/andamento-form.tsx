"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleAlert, Loader2Icon } from "lucide-react";
import { OptionSelect } from "@/components/crud/option-select";
import { useLookupOptions } from "@/components/crud/use-options";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LOOKUP = { api: "/api/status", labelField: "nome" } as const;

/**
 * Registrar andamento do contrato (020-contratos-complementos; `contratos/fluxo` do legado): posta em
 * `POST /api/contrato_status` com o `contratoId` da página. As regras ficam na API:
 * RK-a7017eb6c42d RK-067d06861847 (status obrigatório, `statusIdField`) e RK-f0ce91a53de9
 * (descrição, `contratoStatusFields.descricao`); data do servidor e usuário da sessão.
 */
export function AndamentoForm({ contratoId }: { contratoId: number }) {
  const id = useId();
  const router = useRouter();
  const options = useLookupOptions(STATUS_LOOKUP);
  const [statusId, setStatusId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [atendido, setAtendido] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    let res: Response;
    try {
      res = await fetch("/api/contrato_status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contratoId, statusId, descricao, atendido: atendido ? 1 : 0 }),
      });
    } catch {
      setSaving(false);
      toast.error("Sem conexão com o servidor. O andamento não foi registrado.");
      return;
    }
    setSaving(false);
    if (res.ok) {
      toast.success("Andamento registrado.");
      setStatusId("");
      setDescricao("");
      setAtendido(false);
      startTransition(() => router.refresh());
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { errors?: Record<string, string>; error?: string };
    if (data.errors) {
      setErrors(data.errors);
      if (!data.errors.statusId && !data.errors.descricao && !data.errors.atendido) toast.error(String(Object.values(data.errors)[0]));
      else document.getElementById(data.errors.statusId ? `${id}-status` : `${id}-descricao`)?.focus();
    } else toast.error(data.error ?? "Não foi possível registrar o andamento. Tente de novo em instantes.");
  }

  const busy = saving || refreshing;
  const erro = (campo: string) =>
    errors[campo] ? (
      <FieldError id={`${id}-${campo}-erro`} className="flex items-start gap-1.5">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{errors[campo]}</span>
      </FieldError>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy || undefined} className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 print:hidden">
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <Field data-invalid={Boolean(errors.statusId) || undefined}>
          <FieldLabel htmlFor={`${id}-status`} className="gap-1">
            Status
            <span aria-hidden className="text-destructive">
              *
            </span>
            <span className="sr-only">(obrigatório)</span>
          </FieldLabel>
          <OptionSelect
            id={`${id}-status`}
            value={statusId}
            options={options}
            onChange={setStatusId}
            required
            invalid={Boolean(errors.statusId)}
            describedBy={errors.statusId ? `${id}-statusId-erro` : undefined}
          />
          {erro("statusId")}
        </Field>
        <Field data-invalid={Boolean(errors.descricao) || undefined}>
          <FieldLabel htmlFor={`${id}-descricao`}>Descrição</FieldLabel>
          <Textarea
            id={`${id}-descricao`}
            value={descricao}
            rows={2}
            className="min-h-16"
            onChange={(e) => setDescricao(e.target.value)}
            aria-invalid={Boolean(errors.descricao) || undefined}
            aria-describedby={errors.descricao ? `${id}-descricao-erro` : undefined}
          />
          {erro("descricao")}
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id={`${id}-atendido`} checked={atendido} onCheckedChange={(c) => setAtendido(Boolean(c))} />
          <label htmlFor={`${id}-atendido`} className="text-sm">
            Atendido
          </label>
        </div>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2Icon data-icon="inline-start" aria-hidden className="animate-spin" />}
          Registrar andamento
        </Button>
      </div>
      {erro("atendido")}
    </form>
  );
}
