import type { LoomType } from "loom-expr";

/**
 * Small surface syntax for writing a LoomType inline in a node's yaml block
 * (e.g. `type: bool`, `type: list<option<string>>`). The architecture doc
 * defines the type *system* (§6.3) but not a concrete text grammar for it —
 * this is this parser's concretization, kept intentionally tiny.
 *
 *   type := 'bool' | 'int' | 'float' | 'string'
 *         | 'list' '<' type '>'
 *         | 'option' '<' type '>'
 *         | 'record' '{' ident ':' type (',' ident ':' type)* '}'
 *         | 'enum' '<' ident ':' ident (',' ident)* '>'
 */
class TypeTextParser {
  private i = 0;
  constructor(private readonly text: string) {}

  private skipWs(): void {
    while (this.i < this.text.length && /\s/.test(this.text[this.i]!)) this.i++;
  }

  private peekChar(): string | undefined {
    this.skipWs();
    return this.text[this.i];
  }

  private expectChar(c: string): void {
    this.skipWs();
    if (this.text[this.i] !== c) {
      throw new Error(`expected '${c}' at position ${this.i} in type text '${this.text}'`);
    }
    this.i++;
  }

  private readIdent(): string {
    this.skipWs();
    const start = this.i;
    while (this.i < this.text.length && /[A-Za-z0-9_]/.test(this.text[this.i]!)) this.i++;
    if (this.i === start) {
      throw new Error(`expected an identifier at position ${this.i} in type text '${this.text}'`);
    }
    return this.text.slice(start, this.i);
  }

  parseType(): LoomType {
    const name = this.readIdent();
    switch (name) {
      case "bool":
        return { kind: "bool" };
      case "int":
        return { kind: "int" };
      case "float":
        return { kind: "float" };
      case "string":
        return { kind: "string" };
      case "list": {
        this.expectChar("<");
        const of = this.parseType();
        this.expectChar(">");
        return { kind: "list", of };
      }
      case "option": {
        this.expectChar("<");
        const of = this.parseType();
        this.expectChar(">");
        return { kind: "option", of };
      }
      case "record": {
        this.expectChar("{");
        const fields: Record<string, LoomType> = {};
        if (this.peekChar() !== "}") {
          for (;;) {
            const fieldName = this.readIdent();
            this.expectChar(":");
            fields[fieldName] = this.parseType();
            if (this.peekChar() === ",") {
              this.i++;
              continue;
            }
            break;
          }
        }
        this.expectChar("}");
        return { kind: "record", fields };
      }
      case "enum": {
        this.expectChar("<");
        const enumName = this.readIdent();
        this.expectChar(":");
        const values = [this.readIdent()];
        while (this.peekChar() === ",") {
          this.i++;
          values.push(this.readIdent());
        }
        this.expectChar(">");
        return { kind: "enum", name: enumName, values };
      }
      default:
        throw new Error(`unknown type '${name}' in type text '${this.text}'`);
    }
  }

  finish(): void {
    this.skipWs();
    if (this.i < this.text.length) {
      throw new Error(`unexpected trailing text at position ${this.i} in type text '${this.text}'`);
    }
  }
}

export function parseTypeText(text: string): LoomType {
  const parser = new TypeTextParser(text);
  const type = parser.parseType();
  parser.finish();
  return type;
}
