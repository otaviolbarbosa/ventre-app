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
