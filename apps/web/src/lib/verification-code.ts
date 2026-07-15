import { randomInt } from "node:crypto";

// Sem 0/O/1/I para evitar ambiguidade visual
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateVerificationCode(length = 10): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
}
