import type { CollectionEntry } from 'astro:content';

import {
  PARTICIPATION_MODE_LABELS,
  PARTICIPATION_TYPE_LABELS,
  resolveEventLinks,
  resolveGuestAttribution,
  resolvePlatformLabel,
} from '../components/events/eventMeta';
import { RESOURCE_TYPE_LABELS } from '../components/resources/resourceMeta';
import { blogAuthors } from '../data/team';
import type { Attribution } from '../schema/attribution';
import { classify, type EventDate, formatDisplay } from '../schema/event-date';
import type { ParticipationMode, ParticipationType } from '../schema/events';
import type { ResourceType } from '../schema/resources';
import { resolveOriginEvent, urlForEntry } from './cross-links';
import {
  PLATFORM_CHAR_LIMITS,
  PROMO_PLATFORMS,
  type PromoPlatform,
  REDDIT_TITLE_LIMIT,
} from './promo-platforms';

/**
 * The Epic 11 hub's single field→per-platform-text composition module (AD-8).
 *
 * PURE by contract, in the words `src/lib/cross-links.ts` uses for itself:
 * this module never calls `getCollection`/`getEntry` — callers pass the
 * already-loaded entry/entries in — so it stays unit-testable with fake
 * entries and no content fixtures. It additionally never reads the clock
 * (`buildDate` is an explicit parameter) and never reads `Astro.site` /
 * `import.meta.env` (`siteUrl` is an explicit parameter).
 *
 * Every derivation is delegated to an existing helper (see the AC4 reuse
 * table in Story 11.1) — this module adds no new date parsing, comparators,
 * host matching, or attribution branching. The two genuinely new pieces are
 * the place formatter (a fourth inlined copy — see `EventCard.astro:47`,
 * `PromoStrip.astro:76`, and `promo-image.ts`'s parallel copy, #448 AC5) and
 * the platform text templates themselves.
 */

type EventEntry = CollectionEntry<'events'>;
type ResourceEntry = CollectionEntry<'resources'>;

// ---------------------------------------------------------------------------
// Public types (AC2, AC3) — the single canonical contract.
// ---------------------------------------------------------------------------

export type PromoSubject =
  | { kind: 'event'; entry: EventEntry }
  | { kind: 'resource'; entry: ResourceEntry };

export interface PromoPostBlock {
  /** Feeds `PostText`'s `label` prop. Optional — `x`, `linkedin` and
   *  `discord` omit it and inherit `PostText`'s own `'Post text'` default. */
  label?: string;
  /** Ready-to-copy text. Never empty, never whitespace-only. */
  text: string;
  /** The limit this block was composed against; `null` = no limit. Only the
   *  terminal-arbitration arm of {@link fitWithinLimit} may return a `text`
   *  longer than this. */
  charLimit: number | null;
}

export interface PromoPost {
  platform: PromoPlatform;
  /** >=1 block. `reddit` has exactly 2 (title + body); every other platform
   *  has 1. */
  blocks: PromoPostBlock[];
}

/** The injected, platform-agnostic inputs. */
export interface PromoInput {
  subject: PromoSubject;
  eventsById: Map<string, EventEntry>;
  siteUrl: URL;
  buildDate: Date;
}

/**
 * One flat, tense-aware fact set — an Event OR a Resource normalised to the
 * same shape, so all four platform templates read only from this and never
 * re-derive a field per platform.
 */
export interface PromoFacts {
  title: string;
  dateDisplay: string | undefined;
  timeframe: 'upcoming' | 'past';
  primaryUrl: string;
  siteEntryUrl: string;
  speakerNames: string[];
  kindLabel: string;
  modeLabel: string | undefined;
  place: string | undefined;
  /** Both fields non-empty by construction (AD-13, AC10). `undefined` for a
   *  `host` or absent attribution. */
  guestCredit: { externalHost: string; platform: string } | undefined;
  participation: ParticipationType | undefined;
  mode: ParticipationMode | undefined;
  resourceType: ResourceType | undefined;
  mediaVerb: string | undefined;
}

// ---------------------------------------------------------------------------
// Facts layer (AC3, AC4, AC5, AC6, AC10, AC12, AC13).
// ---------------------------------------------------------------------------

/** Mirrors private `GENERIC_LINK_LABEL` (`resourceMeta.ts`) verbatim — never
 *  import it (it is module-private and stays that way, AC16). */
const RESOURCE_MEDIA_VERB = {
  'recorded talk': 'Watch the recording',
  webinar: 'Watch the recording',
  'podcast episode': 'Listen to the episode',
  paper: 'Read the paper',
} satisfies Record<ResourceType, string>;

/** Reproduces private `resolveResourceLinkLabel(type, url)` exactly. */
function resolveMediaVerb(resourceType: ResourceType, url: string): string {
  if (resourceType === 'paper') {
    return RESOURCE_MEDIA_VERB.paper;
  }
  return resolvePlatformLabel(url) ?? RESOURCE_MEDIA_VERB[resourceType];
}

/**
 * AC10's local re-check narrowing: `resolveGuestAttribution` returns
 * `Attribution | null`, but `Attribution` still TYPES `externalHost` /
 * `platform` as optional even though its `.refine` guarantees both non-empty
 * at runtime for a `guest`. Narrow here, explicitly, with no `!`.
 */
function toGuestCredit(
  attribution: Attribution | null,
): { externalHost: string; platform: string } | undefined {
  if (attribution === null) {
    return undefined;
  }
  const { externalHost, platform } = attribution;
  if (externalHost === undefined || platform === undefined) {
    return undefined;
  }
  return { externalHost, platform };
}

function resolveEventFacts(
  entry: EventEntry,
  siteUrl: URL,
  buildDate: Date,
): PromoFacts {
  const { data } = entry;
  const date = data.date as EventDate;
  const timeframe = classify(date, buildDate);
  const dateDisplay = formatDisplay(date);
  const siteEntryUrl = new URL(urlForEntry(entry), siteUrl).href;

  const links = resolveEventLinks({
    timeframe,
    registerUrl: data.registerUrl,
    resourceUrl: data.resourceUrl,
  });
  const guestAttribution = resolveGuestAttribution(data.attribution);
  const primaryUrl =
    links[0]?.url ?? guestAttribution?.externalUrl ?? siteEntryUrl;

  const speakerNames = data.speakers.map(
    (key) => blogAuthors[key]?.name ?? key,
  );
  // The fourth inlined copy of `EventCard.astro:47`'s
  // `const place = online ? 'Online' : location;` — see this module's header
  // docstring and Story 11.1 Dev Notes ("No place formatter"). Do not
  // refactor the existing callers to share this (out of scope).
  const place = data.online ? 'Online' : data.location;

  return {
    title: data.title,
    dateDisplay,
    timeframe,
    primaryUrl,
    siteEntryUrl,
    speakerNames,
    kindLabel: PARTICIPATION_TYPE_LABELS[data.participation],
    modeLabel: PARTICIPATION_MODE_LABELS[data.mode],
    place,
    guestCredit: toGuestCredit(guestAttribution),
    participation: data.participation,
    mode: data.mode,
    resourceType: undefined,
    mediaVerb: undefined,
  };
}

function resolveResourceFacts(
  entry: ResourceEntry,
  eventsById: Map<string, EventEntry>,
  siteUrl: URL,
  buildDate: Date,
): PromoFacts {
  const { data } = entry;
  // Throws (AD-6, AC13) on a set-but-dangling `originEvent`; returns
  // `undefined` (no throw) when `originEvent` is simply unset.
  const originEvent = resolveOriginEvent(entry, eventsById);

  const timeframe: 'upcoming' | 'past' =
    originEvent !== undefined
      ? classify(originEvent.data.date as EventDate, buildDate)
      : 'past';
  const dateDisplay =
    originEvent !== undefined
      ? formatDisplay(originEvent.data.date as EventDate)
      : undefined;
  const siteEntryUrl = new URL(urlForEntry(entry), siteUrl).href;
  const speakerNames =
    originEvent !== undefined
      ? originEvent.data.speakers.map((key) => blogAuthors[key]?.name ?? key)
      : [];

  const guestAttribution = resolveGuestAttribution(data.attribution);

  return {
    title: data.title,
    dateDisplay,
    timeframe,
    // A Resource's `url` is schema-required and absolute (AC5) — always
    // present, no fallback chain needed.
    primaryUrl: data.url,
    siteEntryUrl,
    speakerNames,
    kindLabel: RESOURCE_TYPE_LABELS[data.resourceType],
    modeLabel: undefined,
    place: undefined,
    guestCredit: toGuestCredit(guestAttribution),
    participation: undefined,
    mode: undefined,
    resourceType: data.resourceType,
    mediaVerb: resolveMediaVerb(data.resourceType, data.url),
  };
}

/**
 * Turn an Event or a Resource into one flat, tense-aware fact set. Every
 * derivation delegates to an existing helper (AC4) — see this module's
 * header docstring.
 */
export function resolvePromoFacts(input: PromoInput): PromoFacts {
  const { subject, eventsById, siteUrl, buildDate } = input;
  if (subject.kind === 'event') {
    return resolveEventFacts(subject.entry, siteUrl, buildDate);
  }
  return resolveResourceFacts(subject.entry, eventsById, siteUrl, buildDate);
}

// ---------------------------------------------------------------------------
// Phrasing tables (AC8).
// ---------------------------------------------------------------------------

/** Oxford-comma join, e.g. `['A']` → `'A'`, `['A','B']` → `'A and B'`,
 *  `['A','B','C']` → `'A, B, and C'`. Never called with `[]` (call sites
 *  guard on `speakerNames.length > 0` first). */
function joinNames(names: string[]): string {
  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return names[0] as string;
  }
  if (names.length === 2) {
    return `${names[0] as string} and ${names[1] as string}`;
  }
  const last = names[names.length - 1] as string;
  const head = names.slice(0, -1).join(', ');
  return `${head}, and ${last}`;
}

function who(speakerNames: string[]): string {
  return speakerNames.length > 0 ? joinNames(speakerNames) : 'Thymian';
}

interface EventLedeContext {
  speakerNames: string[];
  kindLabel: string;
  modeLabel: string;
}

type EventLedeFn = (context: EventLedeContext) => string;

/** Key space built from the imported `ParticipationType`/`ParticipationMode`
 *  — themselves `(typeof PARTICIPATION_TYPES)[number]` /
 *  `(typeof PARTICIPATION_MODES)[number]` — never a hand-typed union. */
type EventLedeKey = `${ParticipationType}:${ParticipationMode}`;

/** Grammatical for all 12 `ParticipationType × ParticipationMode`
 *  combinations, so adding a new type/mode can never crash the composer. */
const DEFAULT_EVENT_LEDE: EventLedeFn = ({
  speakerNames,
  kindLabel,
  modeLabel,
}) =>
  `${who(speakerNames)} is ${modeLabel.toLowerCase()} at this ${kindLabel.toLowerCase()}.`;

/** The four combinations reachable from seed content each get their own,
 *  more natural phrasing; the other 8 of 12 fall to {@link DEFAULT_EVENT_LEDE}. */
const EVENT_LEDES: Partial<Record<EventLedeKey, EventLedeFn>> = {
  'talk:presenting': ({ speakerNames }) =>
    `${who(speakerNames)} is giving this talk.`,
  'booth:attending': ({ speakerNames }) =>
    `${who(speakerNames)} will be at this booth — stop by and say hello.`,
  'livestream:presenting': ({ speakerNames }) =>
    `${who(speakerNames)} is going live for this livestream.`,
  'paper:presenting': ({ speakerNames }) =>
    `${who(speakerNames)} is presenting this paper.`,
};

function eventLede(facts: PromoFacts): string {
  const context: EventLedeContext = {
    speakerNames: facts.speakerNames,
    kindLabel: facts.kindLabel,
    modeLabel: facts.modeLabel ?? '',
  };
  const { participation, mode } = facts;
  if (participation === undefined || mode === undefined) {
    // Unreachable for an event subject — resolveEventFacts always sets both.
    // Kept total (never throws) rather than assuming the invariant.
    return DEFAULT_EVENT_LEDE(context);
  }
  const key: EventLedeKey = `${participation}:${mode}`;
  const fn = EVENT_LEDES[key];
  return (fn ?? DEFAULT_EVENT_LEDE)(context);
}

interface ResourceLedeContext {
  speakerNames: string[];
  mediaVerb: string;
}

type ResourceLedeFn = (context: ResourceLedeContext) => string;

/** A `RESOURCE_TYPES`-keyed table (via the imported `ResourceType`), full
 *  (not `Partial`) — all 4 resource types are named content, no default arm
 *  needed. Folds `PromoFacts.mediaVerb` into the sentence so the fact is
 *  never computed and then left out of the generated text. */
const RESOURCE_LEDES = {
  'recorded talk': ({ speakerNames, mediaVerb }) =>
    speakerNames.length > 0
      ? `${mediaVerb} — featuring ${joinNames(speakerNames)}.`
      : `${mediaVerb}.`,
  webinar: ({ speakerNames, mediaVerb }) =>
    speakerNames.length > 0
      ? `${mediaVerb} — featuring ${joinNames(speakerNames)}.`
      : `${mediaVerb}.`,
  'podcast episode': ({ speakerNames, mediaVerb }) =>
    speakerNames.length > 0
      ? `${mediaVerb} — with ${joinNames(speakerNames)}.`
      : `${mediaVerb}.`,
  paper: ({ speakerNames, mediaVerb }) =>
    speakerNames.length > 0
      ? `${mediaVerb}, authored by ${joinNames(speakerNames)}.`
      : `${mediaVerb}.`,
} satisfies Record<ResourceType, ResourceLedeFn>;

function resourceLede(facts: PromoFacts): string {
  const { resourceType, mediaVerb, speakerNames } = facts;
  if (resourceType === undefined || mediaVerb === undefined) {
    // Unreachable for a resource subject — resolveResourceFacts always sets
    // both. Kept total (never throws) rather than assuming the invariant.
    return mediaVerb ?? 'Watch the recording.';
  }
  return RESOURCE_LEDES[resourceType]({ speakerNames, mediaVerb });
}

/** AC8's sentence, dispatched on which half of {@link PromoFacts} is
 *  populated — `participation` is set only for an event subject. Never
 *  restates `facts.title` (that is clause 1, kept separate). */
function composeLede(facts: PromoFacts): string {
  return facts.participation !== undefined
    ? eventLede(facts)
    : resourceLede(facts);
}

/** 3-5 `#tag` tokens on one line (LinkedIn only), derived from facts —
 *  never a hand-typed hashtag list, so it tracks the entry's own kind. */
function buildHashtags(facts: PromoFacts): string {
  const kindTag = facts.kindLabel.replace(/[^A-Za-z0-9]/g, '');
  const tags = ['Thymian', 'API', 'HTTP', kindTag].filter(
    (tag) => tag.length > 0,
  );
  return [...new Set(tags)].map((tag) => `#${tag}`).join(' ');
}

// ---------------------------------------------------------------------------
// Clause layout, the drop plan, and `fitWithinLimit` (AC9, AC11).
// ---------------------------------------------------------------------------

type ClauseRole =
  | 'title'
  | 'lede'
  | 'kind'
  | 'mode'
  | 'date'
  | 'place'
  | 'guestCredit'
  | 'primaryUrl'
  | 'siteEntryUrl'
  | 'hashtags'
  | 'imageCredit';

/** One atom of a composed block, in canonical emission order. Exported so
 *  {@link fitWithinLimit} can be driven directly with synthetic lists. */
export interface PromoClause {
  role: ClauseRole;
  text: string;
}

/** Clauses 3-6 (`kind`/`mode`/`date`/`place`) render as one middot-joined
 *  line — separable atoms, not one fused sentence, so the drop plan can
 *  remove `place`/`mode`/`date` independently without breaking grammar.
 *  Every other clause is its own line. */
function renderClauses(clauses: PromoClause[]): string {
  const lines: string[] = [];
  let factsLine: string[] = [];

  const flushFactsLine = () => {
    if (factsLine.length > 0) {
      lines.push(factsLine.join(' · '));
      factsLine = [];
    }
  };

  for (const clause of clauses) {
    if (
      clause.role === 'kind' ||
      clause.role === 'mode' ||
      clause.role === 'date' ||
      clause.role === 'place'
    ) {
      factsLine.push(clause.text);
      continue;
    }
    flushFactsLine();
    lines.push(clause.text);
  }
  flushFactsLine();

  return lines.join('\n');
}

/** Never below this many characters (including the trailing ellipsis). */
const TITLE_FLOOR = 40;

/** Truncate `text` to at most `maxLen` characters, on a word boundary, with
 *  a trailing `…` (U+2026) — but never produce a result shorter than
 *  {@link TITLE_FLOOR}. A no-op when `text` already fits. */
function truncateAtWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  const effectiveMax = Math.max(maxLen, TITLE_FLOOR);
  const budget = effectiveMax - 1; // room for the ellipsis
  let cut = text.slice(0, budget);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= TITLE_FLOOR - 1) {
    cut = cut.slice(0, lastSpace);
  }
  return `${cut}…`;
}

/**
 * Step 4 of the drop plan: shrink the `title` clause to the smallest length
 * (word-boundary, `…`-suffixed) that makes the whole block fit `limit`,
 * without ever going below {@link TITLE_FLOOR}. A no-op when there is no
 * `title` clause (e.g. the reddit body).
 */
function truncateTitleClause(
  clauses: PromoClause[],
  limit: number,
): PromoClause[] {
  const titleClause = clauses.find((c) => c.role === 'title');
  if (titleClause === undefined) {
    return clauses;
  }

  const withTitle = (text: string): PromoClause[] =>
    clauses.map((c) => (c.role === 'title' ? { ...c, text } : c));

  for (let len = titleClause.text.length - 1; len >= TITLE_FLOOR; len -= 1) {
    const candidate = withTitle(truncateAtWordBoundary(titleClause.text, len));
    if (renderClauses(candidate).length <= limit) {
      return candidate;
    }
  }

  return withTitle(truncateAtWordBoundary(titleClause.text, TITLE_FLOOR));
}

/** Steps 1-3 and 5-6 of AC9's drop plan (step 4 is {@link truncateTitleClause},
 *  step 7 is "no more steps — return what's left"). Never targets
 *  `guestCredit`, `primaryUrl` or `imageCredit`. */
const PROSE_ROLES: readonly ClauseRole[] = [
  'lede',
  'kind',
  'siteEntryUrl',
  'hashtags',
];

const DROP_STEPS: ((clauses: PromoClause[], limit: number) => PromoClause[])[] =
  [
    (clauses) => clauses.filter((c) => c.role !== 'place'),
    (clauses) => clauses.filter((c) => c.role !== 'mode'),
    (clauses) => clauses.filter((c) => c.role !== 'date'),
    (clauses, limit) => truncateTitleClause(clauses, limit),
    (clauses) => clauses.filter((c) => !PROSE_ROLES.includes(c.role)),
    (clauses) => clauses.filter((c) => c.role !== 'title'),
  ];

/**
 * Apply AC9's ordered drop plan, re-measuring after each step and stopping
 * as soon as the rendered text fits `limit`. `limit === null` (the reddit
 * body) never runs a step. `guestCredit`, `primaryUrl` and `imageCredit`
 * clauses are never targeted by any step — if the block still exceeds
 * `limit` once every step has run (terminal arbitration), the limit loses:
 * the over-limit text is returned as-is rather than ever cutting one of
 * those three. `limit` itself is unaffected — callers still record it as
 * the block's `charLimit`.
 */
export function fitWithinLimit(
  clauses: PromoClause[],
  limit: number | null,
): { text: string; clauses: PromoClause[] } {
  if (limit === null) {
    return { text: renderClauses(clauses), clauses };
  }

  let current = clauses;
  let text = renderClauses(current);

  for (const step of DROP_STEPS) {
    if (text.length <= limit) {
      return { text, clauses: current };
    }
    current = step(current, limit);
    text = renderClauses(current);
  }

  return { text, clauses: current };
}

// ---------------------------------------------------------------------------
// Per-platform clause assembly and the composition entrypoint (AC2, AC7).
// ---------------------------------------------------------------------------

function buildClauses(input: {
  facts: PromoFacts;
  lede: string;
  platform: PromoPlatform;
  includeTitle: boolean;
  includeHashtags: boolean;
  /** The complete, already-composed licence notice, or `undefined` when
   *  none was supplied / it was blank. Appended verbatim (AC11) — never
   *  parsed, split, or reconstructed. */
  creditClauseText: string | undefined;
}): PromoClause[] {
  const {
    facts,
    lede,
    platform,
    includeTitle,
    includeHashtags,
    creditClauseText,
  } = input;
  const clauses: PromoClause[] = [];

  if (includeTitle) {
    // Discord gets a Markdown construct on the title (AC7's per-platform
    // gate) — every other platform renders it plain.
    clauses.push({
      role: 'title',
      text: platform === 'discord' ? `**${facts.title}**` : facts.title,
    });
  }

  clauses.push({ role: 'lede', text: lede });
  clauses.push({ role: 'kind', text: facts.kindLabel });

  if (facts.modeLabel !== undefined) {
    clauses.push({ role: 'mode', text: facts.modeLabel });
  }
  if (facts.dateDisplay !== undefined) {
    clauses.push({ role: 'date', text: facts.dateDisplay });
  }
  if (facts.place !== undefined) {
    clauses.push({ role: 'place', text: facts.place });
  }
  if (facts.guestCredit !== undefined) {
    clauses.push({
      role: 'guestCredit',
      text: `Guest of ${facts.guestCredit.externalHost} on ${facts.guestCredit.platform}`,
    });
  }

  clauses.push({ role: 'primaryUrl', text: facts.primaryUrl });

  // siteEntryUrl: own line on reddit body / linkedin / discord when it
  // differs from primaryUrl; x never gets a second URL (AC5).
  if (platform !== 'x' && facts.siteEntryUrl !== facts.primaryUrl) {
    clauses.push({ role: 'siteEntryUrl', text: facts.siteEntryUrl });
  }

  if (includeHashtags) {
    clauses.push({ role: 'hashtags', text: buildHashtags(facts) });
  }

  if (creditClauseText !== undefined) {
    clauses.push({ role: 'imageCredit', text: creditClauseText });
  }

  return clauses;
}

function buildBlocksForPlatform(
  platform: PromoPlatform,
  facts: PromoFacts,
  lede: string,
  creditClauseText: string | undefined,
): PromoPostBlock[] {
  if (platform === 'reddit') {
    // Block 1: the title clause ONLY, plain text, no URL.
    const titleResult = fitWithinLimit(
      [{ role: 'title', text: facts.title }],
      REDDIT_TITLE_LIMIT,
    );
    // Block 2: full Markdown, every remaining clause — never the title.
    const bodyClauses = buildClauses({
      facts,
      lede,
      platform,
      includeTitle: false,
      includeHashtags: false,
      creditClauseText,
    });
    const bodyResult = fitWithinLimit(bodyClauses, PLATFORM_CHAR_LIMITS.reddit);

    return [
      {
        label: 'Title',
        text: titleResult.text,
        charLimit: REDDIT_TITLE_LIMIT,
      },
      {
        label: 'Post body',
        text: bodyResult.text,
        charLimit: PLATFORM_CHAR_LIMITS.reddit,
      },
    ];
  }

  const clauses = buildClauses({
    facts,
    lede,
    platform,
    includeTitle: true,
    includeHashtags: platform === 'linkedin',
    creditClauseText,
  });
  const limit = PLATFORM_CHAR_LIMITS[platform];
  const result = fitWithinLimit(clauses, limit);

  return [{ text: result.text, charLimit: limit }];
}

/**
 * Compose all 4 platform-tailored posts (5 text blocks) for one subject.
 * Deterministic and side-effect-free: identical input always yields
 * byte-identical output.
 */
export function composePromoPosts(
  input: PromoInput & {
    /** The complete, ready-to-publish licence notice as plain text (AC11),
     *  composed by the caller. Appended verbatim; never parsed, split,
     *  re-wrapped or reconstructed. */
    imageCredit?: string;
  },
): PromoPost[] {
  const { imageCredit, ...promoInput } = input;
  const facts = resolvePromoFacts(promoInput);
  const lede = composeLede(facts);
  const creditClauseText =
    imageCredit !== undefined && imageCredit.trim().length > 0
      ? imageCredit
      : undefined;

  return PROMO_PLATFORMS.map((platform) => ({
    platform,
    blocks: buildBlocksForPlatform(platform, facts, lede, creditClauseText),
  }));
}
