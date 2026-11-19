import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/** Contrato de paginação de toda lista: `page` (1..n), `size` (1..100) e busca `q`. */
export type Pagination = { page: number; size: number; q: string };

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(searchParams: URLSearchParams): Pagination {
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const size = Number.parseInt(searchParams.get("size") ?? String(DEFAULT_PAGE_SIZE), 10);
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    size: Number.isFinite(size) && size > 0 ? Math.min(size, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
    q: (searchParams.get("q") ?? "").trim(),
  };
}

export type Page<T> = { items: T[]; total: number; page: number; size: number };

export function pageResponse<T>(items: T[], total: number, p: Pagination) {
  return NextResponse.json<Page<T>>({ items, total, page: p.page, size: p.size });
}

/** Erros de validação por campo: `{ campo: "mensagem" }`. */
export type FieldErrors = Record<string, string>;

export function fieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "_";
    if (!(field in errors)) errors[field] = issue.message;
  }
  return errors;
}

/** Resposta padrão de validação: `400` com uma mensagem por campo. */
export function validationError(error: ZodError) {
  return NextResponse.json({ errors: fieldErrors(error) }, { status: 400 });
}
