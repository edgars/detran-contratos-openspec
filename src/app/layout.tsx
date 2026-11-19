import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Contratos — DETRAN-RJ",
  description: "Gestão de contratos administrativos do DETRAN-RJ",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // 026-producao: nonce do CSP desta requisição (gerado no middleware) para o script inline do next-themes.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider nonce={nonce}>
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
