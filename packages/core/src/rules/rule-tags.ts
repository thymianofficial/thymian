// The closed concern-tag vocabulary. `security` and `privacy` at the first
// level, a fixed member list at the second — orthogonal to a rule set's own
// topic organisation (directories, chapters, ...). See
// `.github/skills/add-http-rule-set/reference/concern-tags.md` for how to
// choose a member; adding one later is a free union widening.
export const ruleTagVocabulary = {
  security: [
    'transport',
    'cors',
    'cookies',
    'csp',
    'content-type',
    'authentication',
    'authorization',
    'disclosure',
    'dos',
    'cache-poisoning',
    'request-smuggling',
    'clickjacking',
    'csrf',
    'spoofing',
  ],
  privacy: ['tracking', 'fingerprinting', 'referrer'],
} as const satisfies Record<string, readonly string[]>;

export type RuleTagCategory = keyof typeof ruleTagVocabulary;

// One level deep, enforced by construction: a third level and a bare
// category are both unrepresentable here.
type ScopedTag = {
  [C in RuleTagCategory]: `${C}:${(typeof ruleTagVocabulary)[C][number]}`;
}[RuleTagCategory];

// Declared flat, and separately from the structured vocabulary above, so a
// mistyped tag reports a `keyof typeof <object literal>` union — which
// TypeScript prints by listing its members, correct spelling first — rather
// than a mapped type's alias name, which would name `RuleTag` and teach
// nothing. `satisfies` holds the two halves in lockstep: a member in one and
// not the other is a compile error.
export const ruleTagDescriptions = {
  'security:transport':
    'Transport security: TLS, HSTS, scheme downgrade, secure-channel requirements.',
  'security:cors':
    'Cross-origin resource sharing: preflight, credentials, wildcards, header safelisting.',
  'security:cookies': 'Cookie syntax, attributes, lifetime and scope.',
  'security:csp': 'Content Security Policy delivery and content.',
  'security:content-type':
    'Media type handling: sniffing, nosniff, type confusion.',
  'security:authentication':
    'Authentication: challenges, credentials, scheme selection.',
  'security:authorization':
    'Authorization: object-, property- and function-level access control.',
  'security:disclosure':
    "Unintended disclosure of internals, versions, or other parties' data.",
  'security:dos': 'Resource consumption and denial of service.',
  'security:cache-poisoning':
    'Cache poisoning: unkeyed inputs and response splitting reaching a shared cache.',
  'security:request-smuggling':
    'Request smuggling: message-framing ambiguity that lets two hops disagree about boundaries.',
  'security:clickjacking':
    'Clickjacking: UI redress by framing a page inside another origin.',
  'security:csrf':
    'Cross-site request forgery: state-changing requests forged across origins.',
  'security:spoofing':
    'Spoofing: forged identity, origin, or message provenance.',
  'privacy:tracking': 'Cross-site tracking and correlation of users.',
  'privacy:fingerprinting':
    'Passive identification from message characteristics.',
  'privacy:referrer': 'Referrer leakage across origins and down to HTTP.',
} as const satisfies Record<ScopedTag, string>;

// The type every signature uses. Built from the flat record above, not from
// `ScopedTag`, so a typo error lists the legal tags instead of naming an
// alias.
export type RuleTag = keyof typeof ruleTagDescriptions;

export const allRuleTags = Object.keys(ruleTagDescriptions) as RuleTag[];

// Matching is segment-prefix, evaluated pattern-side: a pattern matches a tag
// when the strings are equal or the tag begins with the pattern plus ':'.
// Patterns may be partial — a bare category, or a future third level — while
// a rule's own tag must be fully qualified and terminal; that asymmetry is
// why a bare category is refused on `.tags()` while remaining a legal
// pattern here. Nothing calls this yet (running a concern slice is wave 2),
// but it ships now: it is the written guarantee that a third level can be
// added additively later.
export function tagMatches(
  pattern: RuleTagCategory | RuleTag,
  tag: RuleTag,
): boolean {
  return tag === pattern || tag.startsWith(`${pattern}:`);
}
