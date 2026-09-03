/**
 * The set of declarations the type surface emits, with one copy of each.
 *
 * `json-schema-to-typescript` compiles one schema at a time and each call
 * returns a self-contained unit: the root declaration plus every named
 * component it references. Two transactions that both reference `Astronaut`
 * therefore arrive carrying their own copy of it — nine copies of it, on the
 * demo description, and nine copies of `AstronautInput` and `LaunchInput`
 * beside them.
 *
 * That is not merely noisy. It compiles only for as long as every duplicated
 * component happens to be an `interface`, because identical interfaces merge; a
 * component that compiles to a type ALIAS — an enum, a union, an array — is
 * `TS2300: Duplicate identifier` the moment a second transaction references it.
 * And the drift gate cannot see either, because it compiles hooks with
 * `skipLibCheck: true`, which is exactly the flag that stops TypeScript from
 * reporting errors inside a `.d.ts`.
 *
 * De-duplicating also keeps the committed diff proportionate: editing one
 * component used to move as many lines as there are transactions using it.
 */

/** One top-level declaration, under the name it declares. */
export type Declaration = {
  readonly name: string;
  readonly text: string;
};

const DECLARATION_LINE = /^export (?:interface|type) ([A-Za-z0-9_$]+)/;

/**
 * Splits one `compile()` result into its top-level declarations.
 *
 * Safe on the emitter's output rather than on TypeScript in general: every
 * top-level declaration begins at column zero and everything nested is
 * indented, so a column-zero `export` line — or the `/**` opening the JSDoc
 * block that belongs to it — is a boundary.
 */
export function splitDeclarations(source: string): Declaration[] {
  const lines = source.split('\n');
  const starts: number[] = [];

  lines.forEach((line, index) => {
    if (line === '/**') {
      starts.push(index);

      return;
    }

    // A JSDoc block immediately above a declaration is part of it, so the
    // comment already opened this chunk.
    if (DECLARATION_LINE.test(line) && lines[index - 1]?.trim() !== '*/') {
      starts.push(index);
    }
  });

  return starts.map((start, position) => {
    const end = starts[position + 1] ?? lines.length;
    const text = lines.slice(start, end).join('\n').trimEnd();
    const declared = text
      .split('\n')
      .map((line) => DECLARATION_LINE.exec(line)?.[1])
      .find((name) => name !== undefined);

    if (declared === undefined) {
      throw new Error(
        `The type generator produced a declaration it cannot name:\n${text}`,
      );
    }

    return { name: declared, text };
  });
}

/**
 * Rewrites references to renamed declarations.
 *
 * Scoped to one compiled unit, where an identifier can only mean that unit's
 * own declaration. The lookaround excludes a quoted occurrence, so a string
 * literal type of `"Rank"` survives a `Rank` component being renamed.
 */
function renameReferences(
  text: string,
  renames: ReadonlyMap<string, string>,
): string {
  if (renames.size === 0) {
    return text;
  }

  const names = [...renames.keys()]
    .map((name) => name.replace(/[$]/g, '\\$&'))
    .join('|');

  return text.replace(
    new RegExp(`(?<!["'\\w$])(${names})(?!["'\\w$])`, 'g'),
    (match) => renames.get(match) ?? match,
  );
}

export class DeclarationSet {
  private readonly byName = new Map<string, string>();

  /**
   * Adds one compiled unit and returns the name its root ended up with.
   *
   * A unit whose declarations are all either new or byte-identical to what is
   * already held is merged into it, which is the case every single-document
   * description produces: one `$defs` name is one schema, so every copy of
   * `Astronaut` is the same `Astronaut`.
   *
   * A unit that genuinely conflicts — same component name, different body,
   * which two separate description files can both declare — is given fresh
   * names for **all** of its declarations rather than only the conflicting
   * ones. Renaming part of a unit would leave the rest sharing declarations
   * with whichever unit got there first, and "this component is the one my own
   * root was compiled against" is the property worth keeping.
   */
  add(unit: readonly Declaration[], rootName: string): string {
    if (unit.length === 0) {
      return rootName;
    }

    const conflicts = unit.some((declaration) => {
      const held = this.byName.get(declaration.name);

      return held !== undefined && held !== declaration.text;
    });

    if (!conflicts) {
      for (const declaration of unit) {
        this.byName.set(declaration.name, declaration.text);
      }

      return rootName;
    }

    const renames = new Map<string, string>();

    for (const declaration of unit) {
      renames.set(declaration.name, this.freeName(declaration.name));
    }

    for (const declaration of unit) {
      const name = renames.get(declaration.name) as string;

      this.byName.set(name, renameReferences(declaration.text, renames));
    }

    return renames.get(rootName) ?? rootName;
  }

  /** Every declaration held, in name order. */
  all(): string[] {
    return [...this.byName.keys()].sort().map((name) => {
      return this.byName.get(name) as string;
    });
  }

  private freeName(candidate: string): string {
    let name = candidate;
    let suffix = 1;

    while (this.byName.has(name)) {
      suffix += 1;
      name = `${candidate}_${suffix}`;
    }

    // Claimed immediately: the caller assigns every name in a unit before it
    // writes any of them, so two members of one unit must not pick the same
    // free name.
    this.byName.set(name, '');

    return name;
  }
}
