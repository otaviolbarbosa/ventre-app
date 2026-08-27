const na = "[não informado]";

export function buildSignatureLocalityLine(
  city: string | null,
  state: string | null,
  date: Date,
): string {
  const locality = [city, state].filter(Boolean).join("/") || na;
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

  return `${locality}, ${dateLabel}.`;
}

// "DD/MM/YYYY, HH:mm:ss" — used in the finalized document's stamp overlays and
// authentication certificate audit log, where every timestamp needs the same seconds
// precision (unlike the locality line above, which only needs a calendar date).
export function formatAuditTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  const datePart = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  return `${datePart}, ${timePart}`;
}
