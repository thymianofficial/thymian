/**
 * # The glob corpus — FROZEN
 *
 * The **single place the glob grammar's semantics are stated as data**. The
 * shipped matcher (`src/selectors/path-glob.ts`) is checked against this list
 * and nothing else, so the grammar and the implementation cannot quietly
 * disagree: they can only both agree with the corpus or both fail it.
 *
 * Written before any matcher existed, as the parity spec for the type-level
 * path-glob feasibility gate (thymian-internal#581). That gate said NO-GO on
 * language-server cost and the runtime tier shipped instead; the corpus is
 * unchanged, because what it states is the *grammar*, which the verdict did not
 * touch. The benchmark harness that produced the verdict stays in
 * thymian-internal — it measures a type-level validator that does not ship, and
 * would be dead weight here.
 *
 * Every case carries a {@link CorpusCase.covers} tag naming the grammar clause
 * it discharges, and the parity test asserts that every clause in
 * {@link REQUIRED_COVERAGE} has at least one case. That is what stops a future
 * edit from deleting the only case for "`*` refuses to match zero" and leaving
 * a green suite behind.
 *
 * Paths here are written the way the catalog actually contains them — leading
 * `/`, server base path already prepended, `{param}` in template form.
 */

/** The grammar clauses the corpus is required to cover. */
export const REQUIRED_COVERAGE = [
  'exact',
  'star-one-segment',
  'star-not-zero',
  'star-no-cross-slash',
  'deep-one-segment',
  'deep-many-segments',
  'deep-not-zero',
  'brace-is-literal',
  'case-sensitive',
  'matches-nothing',
] as const;

export type CoverageTag = (typeof REQUIRED_COVERAGE)[number] | 'grammar-edge';

export type CorpusCase = {
  /** The glob, as a user would write it in `{ path: … }`. */
  readonly glob: string;
  /** A path, as the catalog spells it. */
  readonly path: string;
  /** Whether the grammar says the glob names that path. */
  readonly expected: boolean;
  /** The grammar clause this case discharges. */
  readonly covers: CoverageTag;
  /** Why the answer is what it is, in terms of the frozen decision list. */
  readonly because: string;
};

/**
 * The universe of paths the "matches nothing" cases are evaluated against.
 *
 * Stated explicitly because "this glob matches nothing" is a claim about a set,
 * not about a pair, and a corpus of pairs cannot express it on its own.
 */
export const CORPUS_PATHS: readonly string[] = [
  '/v1/admin',
  '/v1/admin/users',
  '/v1/admin/users/{id}',
  '/v1/admin/users/{id}/roles',
  '/v1/admin/users/{id}/roles/{roleId}',
  '/v1/launches',
  '/v1/launches/{id}',
  '/v1/launches/{id}/crew',
  '/v1/Launches',
  '/v1/reports/2024/q1',
];

/**
 * Globs that must resolve to **no** path in {@link CORPUS_PATHS}, with the
 * reason each one is empty. These are the vacuous-glob diagnostic's subjects.
 */
export const EMPTY_GLOBS: readonly {
  readonly glob: string;
  readonly covers: CoverageTag;
  readonly because: string;
}[] = [
  {
    glob: '/v1/nonexistent/**',
    covers: 'matches-nothing',
    because: 'no path begins with the literal prefix at all',
  },
  {
    glob: '/v1/launch*',
    covers: 'grammar-edge',
    because:
      'decision 1: `*` is a whole segment, so `launch*` is a literal segment and no path has one',
  },
  {
    glob: '/v1/**/crew',
    covers: 'grammar-edge',
    because:
      'decision 5: `**` is final-position only, so a mid-path `**` is a literal segment',
  },
  {
    glob: '**/crew',
    covers: 'grammar-edge',
    because:
      'decision 5: a leading `**` is a literal segment, and no path starts with one',
  },
  {
    glob: '/v1/launches/{launchId}',
    covers: 'brace-is-literal',
    because:
      'decision 6: brace text is literal, so `{launchId}` is not a wildcard that finds `{id}`',
  },
  {
    glob: '/v1/admin/**/**',
    covers: 'grammar-edge',
    because:
      'decision 5: only the final `**` is a wildcard; the one before it is a literal segment',
  },
  {
    glob: 'v1/launches',
    covers: 'grammar-edge',
    because:
      'decision 9: anchored at both ends, and every member of `Path` begins with `/`',
  },
];

/** The `(glob, path, expected)` triples. */
export const CORPUS: readonly CorpusCase[] = [
  // --- exact match (decision 8) ---
  {
    glob: '/v1/launches',
    path: '/v1/launches',
    expected: true,
    covers: 'exact',
    because: 'no metacharacter: the glob is just an exact `Path`',
  },
  {
    glob: '/v1/launches',
    path: '/v1/launches/{id}',
    expected: false,
    covers: 'exact',
    because: 'anchored at both ends: an exact glob is not a prefix match',
  },
  {
    glob: '/v1/admin/users/{id}',
    path: '/v1/admin/users/{id}',
    expected: true,
    covers: 'exact',
    because: 'exact match on a path whose last segment is brace text',
  },

  // --- `*` matches exactly one whole segment (decision 1) ---
  {
    glob: '/v1/launches/*',
    path: '/v1/launches/{id}',
    expected: true,
    covers: 'star-one-segment',
    because: '`*` consumes the single segment `{id}`',
  },
  {
    glob: '/v1/*/users',
    path: '/v1/admin/users',
    expected: true,
    covers: 'star-one-segment',
    because: '`*` in a middle segment consumes exactly `admin`',
  },
  {
    glob: '/*/launches',
    path: '/v1/launches',
    expected: true,
    covers: 'star-one-segment',
    because: '`*` consumes the base-path segment',
  },
  {
    glob: '/v1/*/*/{id}',
    path: '/v1/admin/users/{id}',
    expected: true,
    covers: 'star-one-segment',
    because: 'two wildcards, each consuming exactly one segment',
  },
  {
    glob: '/v1/*/*',
    path: '/v1/admin/users/{id}',
    expected: false,
    covers: 'star-one-segment',
    because:
      'two wildcards cover two segments and no more; the glob is one segment short',
  },

  // --- `*` refuses to match zero segments (decision 2) ---
  {
    glob: '/v1/admin/*',
    path: '/v1/admin',
    expected: false,
    covers: 'star-not-zero',
    because: 'decision 2: `*` is one segment, never zero',
  },
  {
    glob: '/v1/launches/*',
    path: '/v1/launches/',
    expected: false,
    covers: 'star-not-zero',
    because:
      'decision 2: the empty trailing segment is not a segment, so `*` has nothing to consume',
  },

  // --- `*` refuses to cross `/` (decision 3) ---
  {
    glob: '/v1/launches/*',
    path: '/v1/launches/{id}/crew',
    expected: false,
    covers: 'star-no-cross-slash',
    because: 'decision 3: `*` never spans a separator',
  },
  {
    glob: '/v1/*',
    path: '/v1/admin/users',
    expected: false,
    covers: 'star-no-cross-slash',
    because: 'decision 3: one `*` cannot cover two segments',
  },

  // --- trailing `**`: one segment, and many (decision 4) ---
  {
    glob: '/v1/admin/**',
    path: '/v1/admin/users',
    expected: true,
    covers: 'deep-one-segment',
    because: 'decision 4: one-or-more, and one is enough',
  },
  {
    glob: '/v1/admin/**',
    path: '/v1/admin/users/{id}/roles/{roleId}',
    expected: true,
    covers: 'deep-many-segments',
    because: 'decision 4: a trailing `**` consumes the whole remaining subtree',
  },
  {
    glob: '/**',
    path: '/v1/reports/2024/q1',
    expected: true,
    covers: 'deep-many-segments',
    because: 'the root subtree glob reaches everything below the root',
  },
  {
    glob: '/v1/*/**',
    path: '/v1/admin/users/{id}',
    expected: true,
    covers: 'deep-many-segments',
    because: '`*` and a trailing `**` compose: one segment then the rest',
  },

  // --- `**` refuses to match zero segments (decision 4) ---
  {
    glob: '/v1/admin/**',
    path: '/v1/admin',
    expected: false,
    covers: 'deep-not-zero',
    because:
      'decision 4: one-or-more, so the subtree glob excludes the subtree root itself',
  },
  {
    glob: '/v1/*/**',
    path: '/v1/launches',
    expected: false,
    covers: 'deep-not-zero',
    because: 'decision 4 again, with a wildcard segment in front of the `**`',
  },

  // --- `{id}` and brace text are literals (decision 6) ---
  {
    glob: '/v1/admin/users/{id}/roles',
    path: '/v1/admin/users/{id}/roles',
    expected: true,
    covers: 'brace-is-literal',
    because:
      'decision 6: the glob spells the brace segment exactly as the path does',
  },
  {
    glob: '/v1/admin/users/{userId}/roles',
    path: '/v1/admin/users/{id}/roles',
    expected: false,
    covers: 'brace-is-literal',
    because: 'decision 6: `{userId}` is literal text and is not `{id}`',
  },
  {
    glob: '/v1/admin/users/*/roles',
    path: '/v1/admin/users/{id}/roles',
    expected: true,
    covers: 'brace-is-literal',
    because:
      '`*` is how a user says "any parameter segment"; braces never do that',
  },

  // --- case sensitivity (decision 7) ---
  {
    glob: '/v1/launches',
    path: '/v1/Launches',
    expected: false,
    covers: 'case-sensitive',
    because: 'decision 7: comparison is byte-for-byte',
  },
  {
    glob: '/v1/Launches',
    path: '/v1/Launches',
    expected: true,
    covers: 'case-sensitive',
    because: 'decision 7, the positive half: the exact spelling does match',
  },
  {
    glob: '/V1/**',
    path: '/v1/launches',
    expected: false,
    covers: 'case-sensitive',
    because: 'decision 7 applies to the literal part of a wildcard glob too',
  },

  // --- globs that name nothing at all ---
  {
    glob: '/v1/nonexistent/**',
    path: '/v1/launches/{id}',
    expected: false,
    covers: 'matches-nothing',
    because:
      'the literal prefix rules the path out before the wildcard is reached',
  },
  {
    glob: '/v1/launch*',
    path: '/v1/launches',
    expected: false,
    covers: 'matches-nothing',
    because:
      'decision 1: `/foo*` is not a legal glob — it is a literal segment that names nothing',
  },
  {
    glob: '/v1/**/crew',
    path: '/v1/launches/{id}/crew',
    expected: false,
    covers: 'matches-nothing',
    because:
      'decision 5: mid-path `**` is literal text, and no segment is spelled `**`',
  },

  // --- further grammar edges worth pinning ---
  {
    glob: '/v1/reports/2024/q1',
    path: '/v1/reports/2024/q1',
    expected: true,
    covers: 'grammar-edge',
    because: 'digits are ordinary literal characters',
  },
  {
    glob: '/v1/reports/*/q1',
    path: '/v1/reports/2024/q1',
    expected: true,
    covers: 'grammar-edge',
    because: 'a wildcard between two literal segments',
  },
  {
    glob: '/v1/**',
    path: '/v1/admin/users/{id}/roles/{roleId}',
    expected: true,
    covers: 'grammar-edge',
    because:
      'the deepest path in the corpus, reached from the shallowest subtree glob',
  },
  {
    glob: '/v1/admin/users/{id}/roles/{roleId}',
    path: '/v1/admin/users/{id}/roles',
    expected: false,
    covers: 'grammar-edge',
    because:
      'a glob longer than the path matches nothing, with no partial credit',
  },
] as const;
