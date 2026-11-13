"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MaskedInput } from "@/components/masked-input";
import { formatCurrency, formatDate } from "@/lib/format";
import { OptionSelect } from "./option-select";
import { useLookupOptions } from "./use-options";
import type { FieldDef } from "./types";

type Values = Record<string, string>;
type Files = Record<string, File | null>;

const DATE_MASK = "##/##/####";

/** Converte o registro da API para os valores do formulário (datas dd/MM/yyyy, dinheiro 1.234,56). */
export function toFormValues(row: Record<string, unknown>, fields: FieldDef[]): Values {
  const out: Values = {};
  for (const f of fields) {
    const v = row[f.name];
    if (v === null || v === undefined) out[f.name] = "";
    else if (f.kind === "date") out[f.name] = formatDate(v as string);
    else if (f.kind === "money") out[f.name] = formatCurrency(v as string).replace(/^-?R\$ /, (m) => (m.startsWith("-") ? "-" : ""));
    else out[f.name] = String(v);
  }
  return out;
}

function toggleOn(field: FieldDef, value: string) {
  const [on] = field.toggleValues ?? ["S", "N"];
  return value === String(on);
}

function FieldControl({
  field,
  value,
  error,
  onChange,
  onFile,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onFile: (f: File | null) => void;
}) {
  const options = useLookupOptions(field.kind === "lookup" ? field.lookup : undefined);
  const id = `campo-${field.name}`;
  const invalid = Boolean(error) || undefined;
  switch (field.kind) {
    case "textarea":
      return <Textarea id={id} value={value} aria-invalid={invalid} onChange={(e) => onChange(e.target.value)} />;
    case "select":
    case "lookup":
      return (
        <OptionSelect
          id={id}
          value={value}
          invalid={invalid}
          options={field.kind === "lookup" ? options : (field.options ?? [])}
          onChange={onChange}
          allowEmpty={!field.required}
        />
      );
    case "toggle": {
      const [on, off] = field.toggleValues ?? ["S", "N"];
      return (
        <Switch
          id={id}
          checked={toggleOn(field, value)}
          onCheckedChange={(checked) => onChange(String(checked ? on : off))}
        />
      );
    }
    case "date":
      return <MaskedInput id={id} mask={DATE_MASK} placeholder="dd/mm/aaaa" value={value} aria-invalid={invalid} onValueChange={onChange} />;
    case "masked":
      return <MaskedInput id={id} mask={field.mask ?? ""} value={value} aria-invalid={invalid} onValueChange={onChange} />;
    case "money":
      return (
        <Input
          id={id}
          inputMode="decimal"
          placeholder="0,00"
          value={value}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ""))}
        />
      );
    case "file":
      return (
        <div className="space-y-1">
          <Input id={id} type="file" accept="application/pdf" aria-invalid={invalid} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          {value && (
            <a className="text-sm underline" href={`/api/arquivos/${value}`} target="_blank" rel="noreferrer">
              Ver PDF atual
            </a>
          )}
        </div>
      );
    case "password":
      return <Input id={id} type="password" autoComplete="new-password" value={value} aria-invalid={invalid} onChange={(e) => onChange(e.target.value)} />;
    case "readonly":
      return <Input id={id} value={value} readOnly disabled />;
    default:
      return <Input id={id} value={value} aria-invalid={invalid} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * Formulário de criação/edição. Envia JSON, ou multipart quando há arquivo escolhido.
 * Erros `400 { errors }` da API aparecem inline no campo; a API é a última palavra.
 */
export function EntityForm({
  title,
  api,
  basePath,
  fields,
  id,
  initial,
  canDelete = true,
  afterSavePath,
  submitLabel = "Salvar",
}: {
  title: string;
  api: string;
  basePath: string;
  fields: FieldDef[];
  id?: number | string;
  initial?: Values;
  canDelete?: boolean;
  afterSavePath?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const editing = id !== undefined;
  const visible = fields.filter((f) => !(editing && f.createOnly));
  const [values, setValues] = useState<Values>(() => {
    const base: Values = {};
    for (const f of fields) base[f.name] = f.kind === "toggle" ? String((f.toggleValues ?? ["S", "N"])[1]) : "";
    return { ...base, ...initial };
  });
  const [files, setFiles] = useState<Files>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    fetch(`${api}/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((row) => setValues((prev) => ({ ...prev, ...toFormValues(row, fields) })))
      .catch(() => toast.error("Registro não encontrado"))
      .finally(() => setLoading(false));
  }, [api, id, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    const payload: Record<string, string> = {};
    for (const f of visible) if (f.kind !== "readonly" && f.kind !== "file") payload[f.name] = values[f.name] ?? "";
    const chosen = Object.entries(files).filter(([, f]) => f);
    let body: BodyInit;
    const headers: HeadersInit = {};
    if (chosen.length) {
      const form = new FormData();
      for (const [k, v] of Object.entries(payload)) form.set(k, v);
      for (const [k, f] of chosen) form.set(k, f as File);
      body = form;
    } else {
      body = JSON.stringify(payload);
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(editing ? `${api}/${id}` : api, { method: editing ? "PUT" : "POST", body, headers });
    setSaving(false);
    if (res.ok) {
      toast.success("Registro salvo");
      router.push(afterSavePath ?? basePath);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.errors) {
      setErrors(data.errors);
      toast.error(String(Object.values(data.errors)[0]));
    } else toast.error(data.error ?? "Não foi possível salvar");
  }

  async function onDelete() {
    const res = await fetch(`${api}/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Registro excluído");
      router.push(basePath);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Não foi possível excluir");
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <FieldGroup>
          {visible.map((f) => (
            <Field key={f.name} data-invalid={Boolean(errors[f.name]) || undefined}>
              <FieldLabel htmlFor={`campo-${f.name}`}>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </FieldLabel>
              <FieldControl
                field={f}
                value={values[f.name] ?? ""}
                error={errors[f.name]}
                onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
                onFile={(file) => setFiles((prev) => ({ ...prev, [f.name]: file }))}
              />
              {f.description && <FieldDescription>{f.description}</FieldDescription>}
              {errors[f.name] && <FieldError>{errors[f.name]}</FieldError>}
            </Field>
          ))}
          {errors._ && <FieldError>{errors._}</FieldError>}
        </FieldGroup>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving || loading}>
          {saving ? "Salvando…" : submitLabel}
        </Button>
        <Button variant="outline" render={<Link href={basePath} />}>
          Cancelar
        </Button>
        {editing && canDelete && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button type="button" variant="destructive" className="ml-auto" />}>
              Excluir
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir este registro?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </form>
  );
}
