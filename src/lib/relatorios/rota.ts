import { NextResponse } from "next/server";
import type { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { handleError } from "@/lib/crud/server";
import { lerParams } from "./params";
import { respostaCsv, toCsv, type ColunaCsv } from "./csv";

/**
 * `GET /api/relatorios/<relatorio>` (019-relatorios): sessão obrigatória (`requireUser`), parâmetros
 * pelo schema estrito do relatório (400 por campo) e, quando `csv` é dado, `formato=csv` baixa o CSV.
 */
export function rotaRelatorio<S extends z.ZodType, R>(opcoes: {
  params: S;
  consultar: (p: z.output<S>) => Promise<R>;
  csv?: { slug: string; colunas: ColunaCsv<never>[]; linhas: (r: R) => unknown[] };
}) {
  return async function GET(request: Request) {
    try {
      await requireUser();
      const lido = lerParams(opcoes.params, new URL(request.url).searchParams);
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
