"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
    } catch {
      setPending(false);
      setError("Sem conexão com o servidor. Verifique a rede e tente de novo.");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPending(false);
      setError(body.error ?? Object.values(body.errors ?? {})[0] ?? "Não foi possível entrar");
      return;
    }
    // Só redireciona para caminhos internos. O botão segue em "Entrando…" até a troca de página.
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  const invalid = error ? true : undefined;
  const toggleLabel = showPassword ? "Ocultar senha" : "Mostrar senha";

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="gap-5">
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="username">Usuário</FieldLabel>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            aria-invalid={invalid}
            aria-describedby={error ? "login-erro" : undefined}
            className="h-10"
          />
        </Field>
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <InputGroup className="h-10">
            <InputGroupInput
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              aria-invalid={invalid}
              aria-describedby={error ? "login-erro" : undefined}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                aria-label={toggleLabel}
                aria-pressed={showPassword}
                aria-controls="password"
                title={toggleLabel}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        {error && <FieldError id="login-erro">{error}</FieldError>}
        <Button type="submit" size="lg" className="h-10 w-full" disabled={pending} aria-busy={pending || undefined}>
          {pending && <Loader2Icon aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </FieldGroup>
    </form>
  );
}
