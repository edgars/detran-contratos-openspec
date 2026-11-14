"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Tema claro/escuro: aplica a classe `.dark` no <html> e lembra a escolha no navegador. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
