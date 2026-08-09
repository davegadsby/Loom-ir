export type TokenType =
  | "number"
  | "string"
  | "ident"
  | "("
  | ")"
  | "["
  | "]"
  | "{"
  | "}"
  | ","
  | "."
  | "?"
  | ":"
  | "+"
  | "-"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "eof";

export interface Token {
  type: TokenType;
  text: string;
  pos: number;
}

const PUNCT: Array<[string, TokenType]> = [
  ["==", "=="],
  ["!=", "!="],
  ["<=", "<="],
  [">=", ">="],
  ["(", "("],
  [")", ")"],
  ["[", "["],
  ["]", "]"],
  ["{", "{"],
  ["}", "}"],
  [",", ","],
  [".", "."],
  ["?", "?"],
  [":", ":"],
  ["+", "+"],
  ["-", "-"],
  ["<", "<"],
  [">", ">"],
];

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let text = "";
      while (j < source.length && source[j] !== quote) {
        text += source[j];
        j++;
      }
      if (j >= source.length) throw new Error(`unterminated string literal at position ${i}`);
      tokens.push({ type: "string", text, pos: i });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j]!)) j++;
      tokens.push({ type: "number", text: source.slice(i, j), pos: i });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j]!)) j++;
      tokens.push({ type: "ident", text: source.slice(i, j), pos: i });
      i = j;
      continue;
    }
    const punct = PUNCT.find(([lexeme]) => source.startsWith(lexeme, i));
    if (punct) {
      tokens.push({ type: punct[1], text: punct[0], pos: i });
      i += punct[0].length;
      continue;
    }
    throw new Error(`unexpected character '${ch}' at position ${i}`);
  }
  tokens.push({ type: "eof", text: "", pos: source.length });
  return tokens;
}
