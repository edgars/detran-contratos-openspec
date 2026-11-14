const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `dd/MM/yyyy HH:mm` no fuso do servidor (020: linha do tempo do andamento e cabeçalho de impressão).
 * `dataInclusao` do andamento guarda o instante real (não meia-noite UTC), por isso usa hora local.
 */
export function formatDataHora(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
