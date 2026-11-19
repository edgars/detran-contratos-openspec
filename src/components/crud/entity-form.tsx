"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, CircleAlert, Eye, FileText, Loader2, Trash2, X } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MaskedInput } from "@/components/masked-input";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OptionSelect } from "./option-select";
import { RemoteLookup } from "./remote-lookup";
import { useLookupOptions } from "./use-options";
import type { FieldDef } from "./types";

type Values = Record<string, string>;
type Files = Record<string, File | null>;

const DATE_MASK = "##/##/####";

/** Classes que tiram a moldura do input quando ele vive dentro de um InputGroup (mesmas do InputGroupInput). */
const GROUP_CONTROL =
  "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent";

/** Converte o registro da API para os valores do formulário (datas dd/MM/yyyy, dinheiro 1.234,56). */
export function toFormValues(row: Record<string, unknown>, fields: FieldDef[]): Values {
  const out: Values = {};
  for (const f of fields) {
    const v = row[f.name];
    if (v === null || v === undefined) out[f.name] = "";
    else if (f.kind === "checkboxes") out[f.name] = (Array.isArray(v) ? v : [v]).map(String).join(",");
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

/** "Novo contrato" -> { noun: "contrato", fem: false }; "Nova fase" -> { noun: "fase", fem: true }. */
function subjectOf(title: string) {
  const m = /^(Novo|Nova|Editar)\s+(.+)$/i.exec(title.trim());
  return m ? { noun: m[2], fem: m[1].toLowerCase() === "nova" } : null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Largura padrão do campo no grid de duas colunas. */
function spanOf(field: FieldDef) {
  if (field.span) return field.span;
  return field.kind === "textarea" || field.kind === "file" ? "full" : "half";
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function FileControl({
  id,
  value,
  file,
  invalid,
  describedBy,
  onFile,
}: {
  id: string;
  value: string;
  file: File | null;
  invalid?: boolean;
  describedBy?: string;
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const title = file ? file.name : value ? "PDF anexado" : "Nenhum PDF escolhido";
  const detail = file ? `${formatSize(file.size)} · será enviado ao salvar` : value ? "Escolha outro PDF só se quiser substituir." : null;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-dashed border-input px-3 py-3 transition-colors sm:flex-row sm:items-center",
        "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
        "has-[input[aria-invalid=true]]:border-destructive",
        file && "border-solid bg-muted/40",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-medium", !file && !value && "text-muted-foreground")}>{title}</p>
          {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {value && !file && (
          <a className={buttonVariants({ variant: "ghost", size: "sm" })} href={`/api/arquivos/${value}`} target="_blank" rel="noreferrer">
            Ver PDF atual
          </a>
        )}
        {file && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              onFile(null);
            }}
          >
            <X aria-hidden />
            Remover
          </Button>
        )}
        <label htmlFor={id} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
          {file || value ? "Trocar PDF" : "Escolher PDF"}
        </label>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="application/pdf"
          className="sr-only"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}

/** Valores marcados de um campo `checkboxes` (guardado no formulário como "A,B"). */
const checkedList = (value: string) => value.split(",").filter(Boolean);

/** Grupo de caixas de seleção (023-perfis-acesso: perfis do usuário); envia a lista dos marcados. */
function CheckboxesControl({
  id,
  field,
  value,
  invalid,
  describedBy,
  labelId,
  onChange,
}: {
  id: string;
  field: FieldDef;
  value: string;
  invalid?: boolean;
  describedBy?: string;
  labelId: string;
  onChange: (v: string) => void;
}) {
  const marcados = checkedList(value);
  const options = field.options ?? [];
  const toggle = (opt: string, on: boolean) => {
    const next = options.map((o) => o.value).filter((v) => (v === opt ? on : marcados.includes(v)));
    onChange(next.join(","));
  };
  return (
    <div
      id={id}
      role="group"
      tabIndex={-1}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      className="grid gap-x-6 gap-y-3 rounded-lg outline-none sm:grid-cols-2"
    >
      {options.map((o) => {
        const optId = `${id}-${o.value}`;
        return (
          <div key={o.value} className="flex items-center gap-2.5">
            <Checkbox id={optId} checked={marcados.includes(o.value)} aria-invalid={invalid} onCheckedChange={(c) => toggle(o.value, c)} />
            <Label htmlFor={optId} className="font-normal">
              {o.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

function FieldControl({
  field,
  value,
  file,
  error,
  describedBy,
  labelId,
  onChange,
  onFile,
}: {
  field: FieldDef;
  value: string;
  file: File | null;
  error?: string;
  describedBy?: string;
  labelId: string;
  onChange: (v: string) => void;
  onFile: (f: File | null) => void;
}) {
  const options = useLookupOptions(field.kind === "lookup" ? field.lookup : undefined);
  const id = `campo-${field.name}`;
  const invalid = Boolean(error) || undefined;
  const a11y = { "aria-invalid": invalid, "aria-describedby": describedBy, "aria-required": field.required || undefined };
  switch (field.kind) {
    case "textarea":
      return (
        <Textarea id={id} value={value} className="min-h-24" maxLength={field.maxLength} {...a11y} onChange={(e) => onChange(e.target.value)} />
      );
    case "select":
    case "lookup":
      return (
        <OptionSelect
          id={id}
          value={value}
          invalid={invalid}
          describedBy={describedBy}
          required={field.required}
          options={field.kind === "lookup" ? options : (field.options ?? [])}
          onChange={onChange}
          allowEmpty={!field.required}
        />
      );
    case "search":
      // Busca remota (tabelas grandes de referência; 022-pessoas-fornecedores, D6).
      return field.lookup ? (
        <RemoteLookup
          id={id}
          value={value}
          lookup={field.lookup}
          invalid={invalid}
          describedBy={describedBy}
          required={field.required}
          allowClear={!field.required}
          onChange={onChange}
        />
      ) : null;
    case "toggle": {
      const [on, off] = field.toggleValues ?? ["S", "N"];
      const checked = toggleOn(field, value);
      return (
        <div className="flex h-8 items-center gap-3">
          <Switch
            id={id}
            checked={checked}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onCheckedChange={(c) => onChange(String(c ? on : off))}
          />
          <span className="text-sm text-muted-foreground" aria-hidden>
            {checked ? "Sim" : "Não"}
          </span>
        </div>
      );
    }
    case "date":
      return (
        <InputGroup>
          <InputGroupAddon>
            <CalendarDays aria-hidden />
          </InputGroupAddon>
          <MaskedInput
            id={id}
            data-slot="input-group-control"
            className={GROUP_CONTROL}
            mask={DATE_MASK}
            placeholder="dd/mm/aaaa"
            value={value}
            {...a11y}
            onValueChange={onChange}
          />
        </InputGroup>
      );
    case "masked":
      return <MaskedInput id={id} mask={field.mask ?? ""} value={value} {...a11y} onValueChange={onChange} />;
    case "money":
      return (
        <InputGroup>
          <InputGroupAddon className="tabular-nums">R$</InputGroupAddon>
          <InputGroupInput
            id={id}
            inputMode="decimal"
            placeholder="0,00"
            className="text-right tabular-nums"
            value={value}
            {...a11y}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ""))}
          />
        </InputGroup>
      );
    case "checkboxes":
      return (
        <CheckboxesControl
          id={id}
          field={field}
          value={value}
          invalid={invalid}
          describedBy={describedBy}
          labelId={labelId}
          onChange={onChange}
        />
      );
    case "file":
      return <FileControl id={id} value={value} file={file} invalid={invalid} describedBy={describedBy} onFile={onFile} />;
    case "password":
      return (
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          value={value}
          maxLength={field.maxLength}
          {...a11y}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "readonly":
      return (
        <p id={id} aria-labelledby={labelId} aria-describedby={describedBy} className="flex min-h-8 items-center text-sm tabular-nums break-words">
          {value ? value : <span className="text-muted-foreground">—</span>}
        </p>
      );
    default:
      return <Input id={id} value={value} maxLength={field.maxLength} {...a11y} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** Contador discreto de caracteres: só aparece a partir de 80% do limite. */
function CharCounter({ field, value }: { field: FieldDef; value: string }) {
  const max = field.maxLength;
  if (!max || !["text", "textarea", "password"].includes(field.kind) || value.length < Math.floor(max * 0.8)) return null;
  const restam = max - value.length;
  return (
    <p className={cn("text-right text-xs tabular-nums", restam === 0 ? "text-foreground" : "text-muted-foreground")} aria-live="polite">
      {value.length.toLocaleString("pt-BR")}/{max.toLocaleString("pt-BR")}
      <span className="sr-only">{restam === 0 ? " — limite atingido" : ` — restam ${restam} caracteres`}</span>
    </p>
  );
}

type Group = { title?: string; fields: FieldDef[] };

/** Agrupa por `section`, na ordem em que cada seção aparece pela primeira vez. */
function groupFields(fields: FieldDef[]): Group[] {
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
  for (const f of fields) {
    const key = f.section ?? "";
    let g = byKey.get(key);
    if (!g) {
      g = { title: f.section, fields: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.fields.push(f);
  }
  return groups;
}

function FieldsGrid({ twoCols, children }: { twoCols: boolean; children: React.ReactNode }) {
  return <div className={cn("grid gap-x-4 gap-y-5", twoCols ? "@xl/form:grid-cols-2" : "max-w-[40rem]")}>{children}</div>;
}

function Section({ group, index, children }: { group: Group; index: number; children: React.ReactNode }) {
  const headingId = `secao-${index}`;
  return (
    <section aria-labelledby={group.title ? headingId : undefined} className="flex flex-col gap-4 border-t border-border pt-6 first-of-type:border-t-0 first-of-type:pt-0">
      {group.title && (
        <h2 id={headingId} className="text-base font-semibold">
          {group.title}
        </h2>
      )}
      {children}
    </section>
  );
}

function cellClass(field: FieldDef, twoCols: boolean) {
  return twoCols && spanOf(field) === "full" ? "@xl/form:col-span-2" : undefined;
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
  submitLabel,
  deleteDescription,
  readOnly = false,
  canAttach = true,
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
  /** Texto do diálogo de exclusão (padrão: aviso de remoção definitiva). */
  deleteDescription?: React.ReactNode;
  /** Só `ver` (023-perfis-acesso): campos desabilitados, sem *Salvar* nem *Excluir*. */
  readOnly?: boolean;
  /** Sem `anexar` (023-perfis-acesso): os campos de arquivo não aparecem. */
  canAttach?: boolean;
}) {
  const router = useRouter();
  const editing = id !== undefined;
  const visible = fields.filter((f) => !(editing && f.createOnly) && (canAttach || f.kind !== "file"));
  const twoCols = visible.some((f) => f.section || f.span === "half");
  const groups = groupFields(visible);
  const subject = subjectOf(title);
  const saveLabel = submitLabel ?? (subject ? `Salvar ${subject.noun}` : "Salvar");
  const [values, setValues] = useState<Values>(() => {
    const base: Values = {};
    for (const f of fields) base[f.name] = f.kind === "toggle" ? String((f.toggleValues ?? ["S", "N"])[1]) : "";
    return { ...base, ...initial };
  });
  const [files, setFiles] = useState<Files>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const focusError = useRef(false);

  useEffect(() => {
    if (!editing) return;
    fetch(`${api}/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((row) => setValues((prev) => ({ ...prev, ...toFormValues(row, fields) })))
      .catch(() => toast.error("Não encontramos este registro. Ele pode ter sido excluído."))
      .finally(() => setLoading(false));
  }, [api, id, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Depois de um salvamento com erro, leva o foco ao primeiro campo destacado.
  useEffect(() => {
    if (!focusError.current) return;
    focusError.current = false;
    const first = visible.find((f) => errors[f.name] && f.kind !== "readonly");
    const el = first && document.getElementById(`campo-${first.name}`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
    }
  }, [errors]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    const payload: Record<string, string | string[]> = {};
    for (const f of visible) {
      if (f.kind === "checkboxes") payload[f.name] = checkedList(values[f.name] ?? "");
      else if (f.kind !== "readonly" && f.kind !== "file") payload[f.name] = values[f.name] ?? "";
    }
    const chosen = Object.entries(files).filter(([, f]) => f);
    let body: BodyInit;
    const headers: HeadersInit = {};
    if (chosen.length) {
      const form = new FormData();
      for (const [k, v] of Object.entries(payload)) {
        if (Array.isArray(v)) for (const item of v) form.append(k, item);
        else form.set(k, v);
      }
      for (const [k, f] of chosen) form.set(k, f as File);
      body = form;
    } else {
      body = JSON.stringify(payload);
      headers["Content-Type"] = "application/json";
    }
    let res: Response;
    try {
      res = await fetch(editing ? `${api}/${id}` : api, { method: editing ? "PUT" : "POST", body, headers });
    } catch {
      setSaving(false);
      toast.error("Sem conexão com o servidor. Verifique a rede e tente salvar de novo.");
      return;
    }
    setSaving(false);
    if (res.ok) {
      toast.success(
        editing ? "Alterações salvas." : subject ? `${capitalize(subject.noun)} ${subject.fem ? "cadastrada" : "cadastrado"}.` : "Dados salvos.",
      );
      router.push(afterSavePath ?? basePath);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.errors) {
      const errs = data.errors as Record<string, string>;
      const onFields = visible.filter((f) => errs[f.name]).length;
      focusError.current = true;
      setErrors(errs);
      if (onFields === 0) toast.error(String(Object.values(errs)[0]));
      else toast.error(onFields === 1 ? "Corrija o campo destacado para salvar." : `Corrija os ${onFields} campos destacados para salvar.`);
    } else toast.error(data.error ?? "Não foi possível salvar. Tente de novo em instantes.");
  }

  async function onDelete() {
    setDeleting(true);
    const res = await fetch(`${api}/${id}`, { method: "DELETE" }).catch(() => null);
    setDeleting(false);
    if (res?.ok) {
      toast.success("Registro excluído.");
      router.push(basePath);
      router.refresh();
    } else if (!res) {
      toast.error("Sem conexão com o servidor. A exclusão não foi feita.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Não foi possível excluir este registro.");
    }
  }

  // Erros que não pertencem a nenhum campo visível (ex.: `_`) aparecem juntos, antes das ações.
  const visibleNames = new Set(visible.map((f) => f.name));
  const generalErrors = Object.entries(errors)
    .filter(([k]) => !visibleNames.has(k))
    .map(([, v]) => v);

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={loading || saving || undefined} className="flex flex-col">
      <div className="@container/form flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {editing && canDelete && !readOnly && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={loading}
                    className="-mx-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                  />
                }
              >
                <Trash2 aria-hidden />
                Excluir
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{subject ? `Excluir ${subject.noun}?` : "Excluir este registro?"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {deleteDescription ?? "O registro será removido definitivamente. Esta ação não pode ser desfeita."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" disabled={deleting} onClick={onDelete}>
                    {deleting && <Loader2 className="animate-spin" aria-hidden />}
                    {deleting ? "Excluindo…" : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </header>

        {readOnly && (
          <p className="-mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="size-4 shrink-0" aria-hidden />
            Somente leitura: o seu perfil permite consultar este registro, mas não alterá-lo.
          </p>
        )}

        {loading ? (
          <div className="flex flex-col gap-6">
            <span className="sr-only" role="status">
              Carregando dados do registro…
            </span>
            {groups.map((g, i) => (
              <Section key={g.title ?? `_${i}`} group={g} index={i}>
                <FieldsGrid twoCols={twoCols}>
                  {g.fields.map((f) => (
                    <div key={f.name} className={cn("flex flex-col gap-2", cellClass(f, twoCols))} aria-hidden>
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className={f.kind === "textarea" ? "h-24" : f.kind === "file" ? "h-16" : "h-8"} />
                    </div>
                  ))}
                </FieldsGrid>
              </Section>
            ))}
          </div>
        ) : (
          // Modo leitura: `disabled` no fieldset desabilita todos os controles de uma vez.
          <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-6">
            {groups.map((g, i) => (
              <Section key={g.title ?? `_${i}`} group={g} index={i}>
                <FieldsGrid twoCols={twoCols}>
                  {g.fields.map((f) => {
                    const controlId = `campo-${f.name}`;
                    const descId = f.description ? `${controlId}-descricao` : undefined;
                    const errId = errors[f.name] ? `${controlId}-erro` : undefined;
                    const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;
                    return (
                      <Field key={f.name} data-invalid={Boolean(errors[f.name]) || undefined} className={cellClass(f, twoCols)}>
                        <FieldLabel id={`${controlId}-rotulo`} htmlFor={controlId} className="gap-1">
                          {f.label}
                          {f.required && (
                            <>
                              <span aria-hidden className="text-destructive">
                                *
                              </span>
                              <span className="sr-only">(obrigatório)</span>
                            </>
                          )}
                        </FieldLabel>
                        <FieldControl
                          field={f}
                          value={values[f.name] ?? ""}
                          file={files[f.name] ?? null}
                          error={errors[f.name]}
                          describedBy={describedBy}
                          labelId={`${controlId}-rotulo`}
                          onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
                          onFile={(file) => setFiles((prev) => ({ ...prev, [f.name]: file }))}
                        />
                        <CharCounter field={f} value={values[f.name] ?? ""} />
                        {f.description && <FieldDescription id={descId}>{f.description}</FieldDescription>}
                        {errors[f.name] && (
                          <FieldError id={errId} className="flex items-start gap-1.5">
                            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>{errors[f.name]}</span>
                          </FieldError>
                        )}
                      </Field>
                    );
                  })}
                </FieldsGrid>
              </Section>
            ))}
            {generalErrors.length > 0 && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive dark:bg-destructive/10"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="flex flex-col gap-1">
                  {generalErrors.map((msg) => (
                    <p key={msg}>{msg}</p>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 border-t bg-background px-6 py-3">
        <div className="flex w-full max-w-3xl flex-wrap items-center gap-2">
          {!readOnly && (
            <Button type="submit" disabled={saving || loading}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              {saving ? "Salvando…" : saveLabel}
            </Button>
          )}
          <Button variant="outline" nativeButton={false} render={<Link href={basePath} />}>
            {readOnly ? "Voltar" : "Cancelar"}
          </Button>
        </div>
      </div>
    </form>
  );
}
