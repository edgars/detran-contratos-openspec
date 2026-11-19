"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/** Menu do usuário logado: trocar senha e sair. */
export function UserMenu({ username }: { username: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  async function logout() {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  const initial = username.trim().charAt(0).toUpperCase() || "?";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-8 gap-2 px-1.5 sm:pr-2" aria-label={`Conta de ${username}`} />}
      >
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
        >
          {initial}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{username}</span>
        <ChevronDown aria-hidden className="hidden size-3.5 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-xs font-normal text-muted-foreground">Conectado como</span>
            <span className="block truncate text-sm font-medium text-foreground">{username}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/conta/senha" />}>
          <KeyRound aria-hidden />
          Trocar senha
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout} disabled={leaving}>
          <LogOut aria-hidden />
          {leaving ? "Saindo…" : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
