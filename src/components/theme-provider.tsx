"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Tema claro/escuro: aplica a classe `.dark` no <html> e lembra a escolha no navegador.
 * `nonce` (026-producao): o script inline do next-themes passa no CSP da requisição.
 */
export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider nonce={nonce} attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
