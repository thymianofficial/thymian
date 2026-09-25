import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type Declaration,
  DeclarationSet,
} from '../src/generation/types/declaration-set.js';

/**
 * The parse counter. `typescript`'s export object is non-configurable, so a
 * spy cannot be installed on it; a wrapper module counting through to the
 * real `createSourceFile` is the one observable the code under test offers.
 */
const parses = vi.hoisted(() => ({ count: 0 }));

vi.mock('typescript', async (importOriginal) => {
  const actual = await importOriginal<typeof import('typescript')>();
  const ts = actual.default;

  return {
    ...actual,
    default: {
      ...ts,
      createSourceFile: (...args: Parameters<typeof ts.createSourceFile>) => {
        parses.count += 1;

        return ts.createSourceFile(...args);
      },
    },
  };
});

/**
 * `N0 -> N1 -> … -> N(length-1)`: the shape that made the variant key
 * quadratic, because every member's closure reaches every member after it.
 */
function chain(length: number, tail = 'string'): Declaration[] {
  return Array.from({ length }, (_, index) => {
    const name = `N${index}`;
    const next = index + 1 < length ? `next?: N${index + 1}` : `end?: ${tail}`;

    return { name, text: `export interface ${name} {\n  ${next};\n}` };
  });
}

/**
 * The reviewer's numbers at round three: one chain of 200 cost 20,100 parses,
 * forty identical copies of it 5.5 seconds. The parse is the only expensive
 * step in keying a variant, so the count of parses is what this pins — not a
 * wall-clock bound, which a slow CI runner turns into noise.
 */
describe('DeclarationSet variant keys', () => {
  afterEach(() => {
    parses.count = 0;
  });

  it('parses each member of a unit at most once', () => {
    const set = new DeclarationSet();

    set.add(chain(200), 'N0');

    expect(parses.count).toBeLessThanOrEqual(200);
  });

  it('parses a text it has already seen zero times', () => {
    const set = new DeclarationSet();

    set.add(chain(200), 'N0');
    parses.count = 0;

    for (let copy = 0; copy < 40; copy += 1) {
      set.add(chain(200), 'N0');
    }

    expect(parses.count).toBe(0);
  });

  it('parses only the unseen texts of a conflicting unit', () => {
    const set = new DeclarationSet();

    set.add(chain(200), 'N0');
    parses.count = 0;

    // The same chain with a different tail: a genuine conflict on `N199`,
    // and `N0`…`N198` are byte-identical to what is held. Renaming the whole
    // unit re-parses its members to rewrite their references — that is
    // `renameReferences`, one parse per member — but keying them must not
    // add a second walk of the chain on top.
    const rootName = set.add(chain(200, 'number'), 'N0');

    expect(rootName).toBe('N0_2');
    expect(parses.count).toBeLessThanOrEqual(200 + 1);
    expect(set.all()).toHaveLength(400);
  });

  it('still tells apart two variants that differ only in what they reference', () => {
    const set = new DeclarationSet();

    expect(set.add(chain(3), 'N0')).toBe('N0');
    expect(set.add(chain(3, 'number'), 'N0')).toBe('N0_2');
    // A third occurrence of the second variant reuses its alias.
    expect(set.add(chain(3, 'number'), 'N0')).toBe('N0_2');
    expect(set.all()).toHaveLength(6);
  });
});
