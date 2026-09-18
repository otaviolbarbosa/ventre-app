// Preposições/partículas de sobrenome de uma palavra só — quando aparecem logo após o
// primeiro nome, contam como parte do segundo nome em vez de serem descartadas sozinhas
// (ex.: "Joana da Costa Oliveira" -> "Joana da Costa", não "Joana da"). Cobre pt-BR (da, de,
// do, das, dos) e as formas estrangeiras mais comuns: holandês/flamengo (van, de), alemão
// (von, zu, vom), francês (de, du), italiano (di, da, del, della, delle, degli, dello) e
// espanhol (de, del).
const SINGLE_WORD_PARTICLES = new Set([
  "da",
  "de",
  "do",
  "das",
  "dos",
  "van",
  "von",
  "di",
  "du",
  "del",
  "della",
  "delle",
  "degli",
  "dello",
  "zu",
  "vom",
]);

// Partículas de duas palavras — precisam ser reconhecidas juntas, senão a primeira metade
// seria tratada como uma preposição de uma palavra só e a segunda ("der"/"den"/"la"/"los")
// ficaria pendurada sem o sobrenome de verdade (ex.: "Erik van der Sar" tem que puxar as
// quatro palavras, não parar em "Erik van der").
const TWO_WORD_PARTICLES = new Set(["van der", "van den", "de la", "de los"]);

// Encurta um nome completo para "primeiro nome" + "segundo nome" (puxando junto uma
// partícula de sobrenome, se houver, mais o nome seguinte) — usado em todo template de
// WhatsApp para deixar a saudação mais direta sem soar impessoal.
export function shortenName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.join(" ");

  const secondWord = (words[1] ?? "").toLowerCase();
  const thirdWord = (words[2] ?? "").toLowerCase();

  if (words.length > 3 && TWO_WORD_PARTICLES.has(`${secondWord} ${thirdWord}`)) {
    return words.slice(0, 4).join(" ");
  }

  const wordCount = SINGLE_WORD_PARTICLES.has(secondWord) ? 3 : 2;
  return words.slice(0, wordCount).join(" ");
}
