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

import ts from 'typescript';

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
 * Whether `identifier` sits in a position a rename may touch: either it NAMES
 * a top-level declaration this set controls, or it REFERS to one.
 *
 * Enumerated rather than inferred, because the alternative ("anything that
 * isn't a property-name or string-literal position") is exactly the
 * reasoning that let a text-level regex rename an identifier-shaped property
 * key: `status: string` and `status: Status` are indistinguishable to a
 * lexical match, but `ts.isPropertySignature(parent) && parent.name ===
 * identifier` is false for the first and irrelevant to the second, because
 * the second's `Status` is the type annotation, not the name.
 *
 * Naming positions — where a declaration's OWN name lives, which a rename
 * must also rewrite so the definition and its references stay one string:
 * - `InterfaceDeclaration.name`, `TypeAliasDeclaration.name`.
 *
 * Reference positions:
 * - `TypeReferenceNode.typeName` — `Status`, `Array<Status>`, `Status[]` (an
 *   `ArrayTypeNode` wrapping a `TypeReferenceNode`).
 * - `ExpressionWithTypeArguments.expression` — `interface X extends Status`,
 *   the shape `allOf` composition emits.
 * - `TypeQueryNode.exprName` — `typeof Status`.
 *
 * A qualified name (`Foo.Status`) never reaches here as an `Identifier`: its
 * `typeName`/`exprName` is a `QualifiedName`, which this function does not
 * match, so a dotted reference is correctly left alone — none of the emitter's
 * own declarations are namespaced.
 */
function isRenameablePosition(identifier: ts.Identifier): boolean {
  const parent = identifier.parent as ts.Node | undefined;

  if (!parent) {
    return false;
  }

  if (ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent)) {
    return parent.name === identifier;
  }

  if (ts.isTypeReferenceNode(parent)) {
    return parent.typeName === identifier;
  }

  if (ts.isExpressionWithTypeArguments(parent)) {
    return parent.expression === identifier;
  }

  if (ts.isTypeQueryNode(parent)) {
    return parent.exprName === identifier;
  }

  return false;
}

/**
 * Rewrites a unit's own declaration names and every reference to them.
 *
 * Scoped to one compiled unit, where an identifier can only mean that unit's
 * own declaration. Parses `text` with the TypeScript API and edits only the
 * identifiers {@link isRenameablePosition} approves — never a property name
 * (identifier-shaped or not), never the contents of a string literal, and
 * never a comment, because none of those are nodes the parser hands to a
 * visitor at all. The edits are applied as raw text splices at the
 * identifiers' own positions, back to front, so everything else — formatting,
 * comments, unrelated text — survives byte-for-byte.
 */
function renameReferences(
  text: string,
  renames: ReadonlyMap<string, string>,
): string {
  if (renames.size === 0) {
    return text;
  }

  const source = ts.createSourceFile(
    'declaration.d.ts',
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const edits: Array<{ start: number; end: number; replacement: string }> = [];

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && isRenameablePosition(node)) {
      const replacement = renames.get(node.text);

      if (replacement !== undefined) {
        edits.push({
          start: node.getStart(source),
          end: node.getEnd(),
          replacement,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  let result = text;

  // Back to front, so an earlier edit's offsets never shift a later one's.
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result =
      result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
  }

  return result;
}

export class DeclarationSet {
  private readonly byName = new Map<string, string>();
  /**
   * Every name that may not be handed to a new declaration as-is: every name
   * already committed to {@link byName}, plus the {@link reserved} fixed
   * roots the caller seeds the set with. A name can be in here without being
   * in `byName` — a reserved root nothing has collided with yet — which is
   * exactly what makes a reservation free to check and free of output: {@link
   * all} only ever reads `byName`.
   */
  private readonly used: Set<string>;
  /**
   * For each ORIGINAL declaration name, the raw (pre-rename) text of every
   * variant this set has already resolved a final name for — whether that
   * final name is the bare name itself (the non-conflict branch) or a
   * renamed alias (the conflict branch).
   *
   * What makes this safe to reuse across separate `add()` calls: two
   * declarations that share both a name and byte-identical text are the same
   * declaration by this set's own definition of "conflict" (`text !==
   * text`), so pointing a later occurrence at an earlier resolution is never
   * a merge of two DIFFERENT things — only ever the same thing recognized
   * twice. Keyed by the RAW text (before this call's renames are applied),
   * because every occurrence of, say, a `Status`-named component carries that
   * same raw form regardless of which final name it ends up resolving to —
   * that is the one constant a repeat occurrence can be recognized by.
   *
   * Without this, a component that conflicts with a fixed root — or with
   * another document's differently-bodied same-named component — mints a
   * FRESH suffix every single time it recurs (`Status_2`, `Status_3`, …one
   * per referencing transaction), because the conflict branch used to treat
   * every conflicting unit as unprecedented. That defeats the set's own
   * purpose: "one declaration per component" is exactly the guarantee this
   * index restores for the conflict branch, matching what the non-conflict
   * branch already gives for free.
   */
  private readonly resolved = new Map<string, Map<string, string>>();

  /**
   * @param reserved the fixed root names {@link NameRegistry} mints around
   * the generated declarations — `Status`, `Method`, `Endpoints` and the
   * rest. A component whose OWN name collides with one of these can never be
   * merged into it (they are never the same declaration), so a reservation
   * has to force the conflict branch even though nothing with that name has
   * been committed yet. Sharing the exact list `NameRegistry` was
   * constructed with is what keeps the two reservations from drifting apart.
   */
  constructor(reserved: Iterable<string> = []) {
    this.used = new Set(reserved);
  }

  /** Records that `originalName`/`originalText` resolved to `finalName`, and commits `finalName`/`finalText` as held. */
  private commit(
    finalName: string,
    finalText: string,
    originalName: string,
    originalText: string,
  ): void {
    this.byName.set(finalName, finalText);
    this.used.add(finalName);

    let variants = this.resolved.get(originalName);

    if (!variants) {
      variants = new Map();
      this.resolved.set(originalName, variants);
    }

    variants.set(originalText, finalName);
  }

  /**
   * Adds one compiled unit and returns the name its root ended up with.
   *
   * A unit whose declarations are all either new or byte-identical to what is
   * already held is merged into it, which is the case every single-document
   * description produces: one `$defs` name is one schema, so every copy of
   * `Astronaut` is the same `Astronaut`.
   *
   * A unit that genuinely conflicts is given fresh names for **all** of its
   * declarations rather than only the conflicting ones. Renaming part of a
   * unit would leave the rest sharing declarations with whichever unit got
   * there first, and "this component is the one my own root was compiled
   * against" is the property worth keeping. Two shapes reach this branch:
   * same component name, different body — which two separate description
   * files can both declare — and a component named after one of the fixed
   * roots this set was seeded with, which is a conflict on sight because a
   * user's component and the surface's own `Status` are never the same
   * declaration.
   *
   * "Fresh" does not mean "unconditionally new", though: {@link resolved}
   * recognizes a (name, text) pair this set has already renamed once and
   * reuses that name rather than minting another alias for it, so a
   * component that conflicts with a fixed root — or with another document's
   * component of the same name — is still deduplicated across every site
   * that declares it identically, exactly as a non-conflicting component
   * already is.
   */
  add(unit: readonly Declaration[], rootName: string): string {
    if (unit.length === 0) {
      return rootName;
    }

    const conflicts = unit.some((declaration) => {
      if (!this.used.has(declaration.name)) {
        return false;
      }

      return this.byName.get(declaration.name) !== declaration.text;
    });

    if (!conflicts) {
      for (const declaration of unit) {
        this.commit(
          declaration.name,
          declaration.text,
          declaration.name,
          declaration.text,
        );
      }

      return rootName;
    }

    const renames = new Map<string, string>();

    for (const declaration of unit) {
      // A variant this exact (name, text) pair already resolved — reuse it
      // rather than minting another alias for the same content.
      const reused = this.resolved.get(declaration.name)?.get(declaration.text);

      renames.set(declaration.name, reused ?? this.freeName(declaration.name));
    }

    for (const declaration of unit) {
      const name = renames.get(declaration.name) as string;

      // Already resolved by an earlier `add()` call: its text is already
      // correct, and re-deriving it here would just repeat that work.
      if (this.byName.has(name)) {
        continue;
      }

      this.commit(
        name,
        renameReferences(declaration.text, renames),
        declaration.name,
        declaration.text,
      );
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

    while (this.used.has(name)) {
      suffix += 1;
      name = `${candidate}_${suffix}`;
    }

    // Claimed immediately: the caller assigns every name in a unit before it
    // writes any of them, so two members of one unit must not pick the same
    // free name.
    this.used.add(name);

    return name;
  }
}
