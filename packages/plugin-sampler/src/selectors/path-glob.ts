/**
 * # The path-glob grammar — FROZEN
 *
 * A glob is a string compared against a path as the transaction catalog spells
 * it: beginning with `/`, already carrying the API description's server base
 * path, with `{param}` in template form. Both sides are compared **segment by
 * segment**, where a segment is a maximal run of characters containing no `/`.
 *
 * ```ebnf
 * glob            = segment , { "/" , segment } , [ "/" , deep-wildcard ] ;
 * segment         = wildcard | literal-segment ;
 * wildcard        = "*" ;                  (* the WHOLE segment, never part *)
 * deep-wildcard   = "**" ;                 (* final position only *)
 * literal-segment = { literal-char } ;     (* matched byte-for-byte *)
 * literal-char    = ? any character except "/" ? ;
 * ```
 *
 * ## The decisions (all of them explicit, all of them frozen)
 *
 * 1. **`*` matches exactly one whole segment.** It never matches part of a
 *    segment. `/foo*` is therefore **not a legal glob** — it is a segment whose
 *    literal text happens to be `foo*`, which matches no real path, and which
 *    `validate` reports as "matches nothing". It is deliberately *not* a
 *    separate "malformed glob" diagnostic: one diagnostic for "this names
 *    nothing" is the whole promise, and a second class of error would have to
 *    be kept in sync with the first.
 * 2. **`*` matches exactly one segment — never zero.** `/users/*` does not
 *    match `/users`, and does not match `/users/` (whose trailing segment is
 *    the empty string).
 * 3. **`*` never crosses `/`.** `/users/*` does not match `/users/1/orders`.
 * 4. **A trailing `**` matches one *or more* segments.** `/admin/**` matches
 *    `/admin/users` and `/admin/users/42/roles`, and does **not** match
 *    `/admin` itself. A user who wants both writes two entries. This is the
 *    decision most likely to be argued later, so: it is one-or-more, and the
 *    reason is that `/admin/**` reads as "everything *under* /admin", and a
 *    zero-or-more reading makes `{ path: '/admin/**' }` silently a superset of
 *    `{ path: '/admin' }` — two different intents spelled the same way.
 * 5. **`**` is legal only as the final segment.** Leading and mid-path `**`
 *    are out; mid-path `**` is deferred. A `**` anywhere else is, again, just a
 *    literal segment that matches nothing.
 * 6. **`{id}` — and any other brace text — is a literal.** Real paths contain
 *    `{id}`, `{launchId}` and so on, because the loader keeps the template
 *    form. A glob spells them exactly as the path does. Braces are **not**
 *    metacharacters and never will be in this grammar.
 * 7. **Matching is case-sensitive and exact.** `/Users/*` does not match
 *    `/users/1`. No normalisation, no trailing-slash tolerance, no percent
 *    decoding.
 * 8. **A glob containing no metacharacter is just an exact path.** It has to
 *    equal a path the catalog holds, and it is validated by the same rule as
 *    every other glob: does it name at least one path.
 * 9. **Anchoring.** A glob is matched against the whole path string, anchored
 *    at both ends — there is no implicit prefix or suffix wildcard. The string
 *    it is anchored against carries the server base path, so on a description
 *    whose server is `https://api.example.com/v1`, the glob for the spec's own
 *    `/admin/**` example is `/v1/admin/**`.
 *
 * ## Deliberately excluded — this list is closed
 *
 * `?` (single character); character classes (`[a-z]`); brace alternation
 * (`{a,b}`); regular expressions of any kind; leading or mid-path `**`;
 * negation inside a glob (exclusion is `not:`, a filter-level feature);
 * case-insensitive matching; escaping (there is no escape character, because
 * there is nothing to escape: `*` in a literal position is already just a
 * character that matches nothing); and **globbing on any filter field other
 * than `path`** — `method`, `status`, `statusClass`, `requestMediaType` and
 * `responseMediaType` stay closed unions.
 *
 * Anything not on the "in" list is out.
 *
 * The semantics above are stated as data in `bench/glob-corpus.ts`, and
 * {@link matchesPathGlob} is checked against that corpus and nothing else.
 */

/**
 * Whether `glob` names `path`.
 *
 * Written directly from the decision list above, iteratively rather than
 * recursively, so that reading it against the grammar is a one-pass job.
 */
export function matchesPathGlob(glob: string, path: string): boolean {
  const globSegments = glob.split('/');
  const pathSegments = path.split('/');
  const deep = globSegments.at(-1) === '**';

  // Decision 5: `**` is legal only as the final segment. Anywhere else it is a
  // literal segment, which is what the equality branch below gives it.
  const fixed = deep ? globSegments.slice(0, -1) : globSegments;

  // Decision 4: a trailing `**` needs one or more segments to consume, so the
  // path must be strictly longer than the fixed prefix. Without a trailing
  // `**` the two must have the same number of segments — decisions 2 and 3.
  if (
    deep
      ? pathSegments.length <= fixed.length
      : pathSegments.length !== fixed.length
  ) {
    return false;
  }

  for (const [index, globSegment] of fixed.entries()) {
    const pathSegment = pathSegments[index] ?? '';

    if (globSegment === '*') {
      // Decision 2: exactly one segment, never zero. An empty segment is not a
      // segment.
      if (pathSegment === '') {
        return false;
      }

      continue;
    }

    // Decisions 1, 6, 7, 8: everything else is literal, compared exactly.
    if (globSegment !== pathSegment) {
      return false;
    }
  }

  return true;
}

/**
 * Whether a path value carries a wildcard at all (decision 8).
 *
 * Only used for the wording of a diagnostic: an exact path that names nothing
 * and a glob that names nothing are the same fault, but "no path is spelled
 * that way" and "that glob matches nothing" are not the same sentence.
 *
 * Any `*` counts, not only a whole-segment one. `/v1/launch*` is a glob the
 * user wrote — `PathGlob` accepts it and the grammar says so — it is just a
 * glob that names nothing, because decision 1 makes `launch*` a literal
 * segment. Testing for a whole-segment `*` instead told that user no path was
 * *spelled* `/v1/launch*`, which is true and unhelpful.
 */
export function hasWildcard(value: string): boolean {
  return value.includes('*');
}
