import { NextResponse } from "next/server";
import type { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import type { Recurso } from "@/lib/auth/permissions";
import { handleError } from "@/lib/crud/server";
import { lerParams } from "./params";
import { respostaCsv, toCsv, type ColunaCsv } from "./csv";

/**
 * `GET /api/relatorios/<relatorio>` (019-relatorios): sessão obrigatória, parâmetros pelo schema
 * estrito do relatório (400 por campo) e, quando `csv` é dado, `formato=csv` baixa o CSV.
 * 023-perfis-acesso: a consulta exige `listar` no `recurso` (padrão `relatorios`) e o CSV, `exportar`.
 */
export function rotaRelatorio<S extends z.ZodType, R>(opcoes: {
  params: S;
  consultar: (p: z.output<S>) => Promise<R>;
  csv?: { slug: string; colunas: ColunaCsv<never>[]; linhas: (r: R) => unknown[] };
  recurso?: Recurso;
}) {
  const recurso = opcoes.recurso ?? "relatorios";
  return async function GET(request: Request) {
    try {
      const params = new URL(request.url).searchParams;
      await requirePermission(recurso, "listar");
      // Exportação (CSV) só com `exportar` (Consulta vê na tela, não exporta).
      if (params.get("formato") === "csv" && opcoes.csv) await requirePermission(recurso, "exportar");
      const lido = lerParams(opcoes.params, params);
      if (!lido.ok) throw lido.error;
      const resultado = await opcoes.consultar(lido.data);
      const formato = (lido.data as { formato?: string }).formato;
      if (formato === "csv" && opcoes.csv) {
        const colunas = opcoes.csv.colunas as ColunaCsv<unknown>[];
        return respostaCsv(opcoes.csv.slug, toCsv(colunas, opcoes.csv.linhas(resultado)));
      }
      return NextResponse.json(resultado);
    } catch (error) {
      return handleError(error);
    }
  };
}
