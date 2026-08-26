import { ThymianBaseError } from '@thymian/core';

import { compareStrings } from './type-names.js';

/**
 * The set of top-level declarations the surface emits, de-duplicated.
 *
 * v1 performed no de-duplication at all: every schema got a fresh alias and
 * every `compile()` call re-emitted its nested named interfaces, so two
 * endpoints sharing a `$defs/Pet` emitted `export interface Pet { … }` twice.
 * That was invisible while the file was a regenerated scratch artifact; it is a
 * hard failure now that the file is committed and `validate` runs `tsc` over it
 * — and not only for divergent bodies: two IDENTICAL interfaces still collide on
 * the `[k: string]: unknown` index signature that `additionalProperties: true`
 * adds (TS2374), and an identical type alias is a duplicate identifier (TS2300).
 *
 * De-duplication is on the emitted TEXT, which is a function of the canonical
 * schema content plus the assigned name — the two things
 * `schema-definitions.ts` makes site-independent. Emission order is sorted, so
 * inserting a transaction slots its declarations in rather than shifting
 * everything after them.
 *
 * AND IT IS WHERE ONE IDENTIFIER WITH TWO BODIES IS CAUGHT. De-duplicating on
 * text answers "have I seen this declaration before"; it never asked "have I
 * seen this NAME before", so two different bodies claiming one identifier were
 * both kept and both emitted. That is a duplicate identifier in the committed
 * file — TS2374 for interfaces, TS2300 for aliases — and it is the one shape
 * `emitted-names.ts` structurally cannot see, because it reviews a single
 * `compile()` output while this collides ACROSS calls (round 5: a `$defs` entry
 * reached from two transactions under two different names).
 *
 * The check is deliberately a property of the emitted FILE rather than a model
 * of the library's namer. It cannot false-positive: if two texts declare one
 * identifier, the file really is broken, whatever produced them.
 */
export class DeclarationSet {
  private readonly byText = new Map<string, string>();
  private readonly byIdentifier = new Map<string, string>();

  /** Adds every top-level declaration in one `compile()` output. */
  add(compiled: string): void {
    for (const declaration of splitDeclarations(compiled)) {
      const identifier = identifierOf(declaration);

      if (identifier.length > 0) {
        const incumbent = this.byIdentifier.get(identifier);

        if (incumbent !== undefined && incumbent !== declaration) {
          throw new ThymianBaseError(
            `Two different declarations both claim the name "${identifier}", so the generated types would not compile.`,
            {
              name: 'DuplicateDeclarationError',
              suggestions: [
                `Two schemas in the API description resolve to the type name "${identifier}" with different contents.`,
                'Rename one of them, or give them the same definition.',
              ],
            },
          );
        }

        this.byIdentifier.set(identifier, declaration);
      }

      this.byText.set(declaration, identifier);
    }
  }

  addAll(compiled: Iterable<string>): void {
    for (const output of compiled) {
      this.add(output);
    }
  }

  /** Sorted by declared identifier, then by text so the order is total. */
  toSortedArray(): string[] {
    return [...this.byText.entries()]
      .sort(
        ([textA, nameA], [textB, nameB]) =>
          compareStrings(nameA, nameB) || compareStrings(textA, textB),
      )
      .map(([text]) => text);
  }
}

const DECLARATION_START = /^(?:export|declare)\b/;
const JSDOC_START = /^\/\*\*/;
/**
 * `const\s+enum` HAS TO COME FIRST, and that is a bug fix rather than a
 * micro-optimisation. Alternation is ordered, so with a bare `const` ahead of it
 * `export const enum Kind {…}` matched `const` as the declaration keyword and
 * captured `enum` as the NAME — {@link identifierOf} returned the string
 * `"enum"`, which sorts and de-duplicates as if every `const enum` in the file
 * were the same declaration. The library really can emit one: a schema carrying
 * `tsEnumNames` reaches its `NAMED_ENUM` branch (see `type-names.ts`,
 * `TYPE_DIRECTIVE_KEYWORDS`). `export const x = 1` still yields `x`, because the
 * `const\s+enum` alternative simply fails to match it.
 */
const IDENTIFIER =
  /^export\s+(?:declare\s+)?(?:const\s+enum|interface|type|enum|class|const|function)\s+([A-Za-z_$][\w$]*)/m;

/** The identifier a declaration declares, or the empty string when the shape is
 * unrecognised — in which case the text itself carries the ordering. */
export function identifierOf(declaration: string): string {
  return IDENTIFIER.exec(declaration)?.[1] ?? '';
}

/**
 * Splits one `compile()` output into its top-level declarations.
 *
 * `json-schema-to-typescript` never indents a top-level declaration and puts a
 * `description`'s JSDoc immediately above the declaration it documents, so
 * column 0 is the reliable boundary — and a JSDoc block belongs to what follows
 * it, not to what precedes it. Splitting matters because the duplicate that has
 * to be removed is a NESTED declaration sharing an output with a unique one.
 */
export function splitDeclarations(compiled: string): string[] {
  const declarations: string[] = [];
  let current: string[] = [];
  let insideJsDoc = false;
  let jsDocPending = false;

  const flush = (): void => {
    const text = current.join('\n').trim();

    if (text.length > 0) {
      declarations.push(text);
    }

    current = [];
  };

  for (const line of compiled.split('\n')) {
    if (insideJsDoc) {
      current.push(line);

      if (line.trimEnd().endsWith('*/')) {
        insideJsDoc = false;
        jsDocPending = true;
      }

      continue;
    }

    if (JSDOC_START.test(line)) {
      flush();
      current.push(line);
      insideJsDoc = !line.trimEnd().endsWith('*/');
      jsDocPending = !insideJsDoc;

      continue;
    }

    if (DECLARATION_START.test(line)) {
      if (!jsDocPending) {
        flush();
      }

      jsDocPending = false;
      current.push(line);

      continue;
    }

    current.push(line);
  }

  flush();

  return declarations;
}
