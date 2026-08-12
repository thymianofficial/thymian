import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';

import { blogAuthors } from '../src/data/team';
import { indexEventsById } from '../src/lib/cross-links';
import {
  PLATFORM_CHAR_LIMITS,
  PROMO_PLATFORMS,
  type PromoPlatform,
  REDDIT_TITLE_LIMIT,
} from '../src/lib/promo-platforms';
import {
  composePromoPosts,
  fitWithinLimit,
  type PromoClause,
  type PromoInput,
  type PromoPost,
  type PromoPostBlock,
  resolvePromoFacts,
} from '../src/lib/promo-post';
import type { Attribution } from '../src/schema/attribution';
import type { EventDate } from '../src/schema/event-date';
import {
  PARTICIPATION_MODES,
  PARTICIPATION_TYPES,
  type ParticipationMode,
  type ParticipationType,
} from '../src/schema/events';
import type { ResourceType } from '../src/schema/resources';
import { TEAM_KEYS } from '../src/schema/team-keys';

// Fake entries — mirror the `event()`/`resource()` idiom in
// `test/cross-links.test.ts` / `test/promo-strip-meta.test.ts`: minimal
// object literals cast `as unknown as EventEntry`/`ResourceEntry`. No
// content fixtures. A fixed BUILD_DATE and siteUrl throughout — the module
// must never read the real clock or `Astro.site`.
type EventEntry = CollectionEntry<'events'>;
type ResourceEntry = CollectionEntry<'resources'>;

const BUILD_DATE = new Date('2026-08-01');
const SITE_URL = new URL('https://thymian.dev');

const exact = (iso: string): EventDate => ({
  precision: 'exact',
  date: new Date(iso),
});
const monthPrecision = (year: number, month: number): EventDate => ({
  precision: 'month',
  year,
  month,
});
const tba: EventDate = { precision: 'tba' };

interface EventOverrides {
  title?: string;
  participation?: ParticipationType;
  mode?: ParticipationMode;
  speakers?: string[];
  location?: string;
  online?: boolean;
  date?: EventDate;
  attribution?: Attribution;
  registerUrl?: string;
  resourceUrl?: string;
}

function event(id: string, overrides: EventOverrides = {}): EventEntry {
  return {
    id,
    collection: 'events',
    data: {
      title: overrides.title ?? id,
      participation: overrides.participation ?? 'talk',
      mode: overrides.mode ?? 'presenting',
      speakers: overrides.speakers ?? [],
      location: overrides.location,
      online: overrides.online,
      date: overrides.date ?? exact('2026-07-08'),
      attribution: overrides.attribution,
      registerUrl: overrides.registerUrl,
      resourceUrl: overrides.resourceUrl,
    },
  } as unknown as EventEntry;
}

interface ResourceOverrides {
  title?: string;
  resourceType?: ResourceType;
  url?: string;
  embeddable?: boolean;
  attribution?: Attribution;
  originEvent?: string;
}

function resource(
  id: string,
  overrides: ResourceOverrides = {},
): ResourceEntry {
  return {
    id,
    collection: 'resources',
    data: {
      title: overrides.title ?? id,
      resourceType: overrides.resourceType ?? 'recorded talk',
      url: overrides.url ?? 'https://example.com/resource',
      embeddable: overrides.embeddable ?? true,
      attribution: overrides.attribution ?? { hostGuest: 'host' },
      originEvent:
        overrides.originEvent === undefined
          ? undefined
          : { collection: 'events', id: overrides.originEvent },
    },
  } as unknown as ResourceEntry;
}

const TEAM_KEY = TEAM_KEYS[0] as string;
const TEAM_NAME = blogAuthors[TEAM_KEY]?.name ?? TEAM_KEY;

const GUEST_ATTRIBUTION: Attribution = {
  hostGuest: 'guest',
  externalHost: 'My Coding Zone',
  platform: 'YouTube',
  externalUrl: 'https://www.youtube.com/watch?v=1IvUSEnGkZ8',
};

// The 6 seed-shaped subjects (5 Events + 1 Resource), matching the content
// reality table in the story's Dev Notes (verified 2026-08-11/12).
function apidaysEvent(overrides: EventOverrides = {}): EventEntry {
  return event('apidays-munich-should-i-get-or-should-i-post', {
    title:
      'apidays Munich: Should I GET or Should I POST — The Clash With HTTP Conformance',
    participation: 'talk',
    mode: 'presenting',
    speakers: [TEAM_KEY],
    location: 'Munich',
    date: exact('2026-07-08'),
    ...overrides,
  });
}

function frankenjsEvent(overrides: EventOverrides = {}): EventEntry {
  return event('frankenjs-spice-up-your-api', {
    title: 'FrankenJS: Spice Up Your API With Thymian',
    participation: 'talk',
    mode: 'presenting',
    speakers: [TEAM_KEY],
    location: 'Nuremberg',
    date: exact('2024-10-23'),
    ...overrides,
  });
}

function frosconEvent(overrides: EventOverrides = {}): EventEntry {
  return event('froscon-community-booth', {
    title: 'FrosCon: Community Booth',
    participation: 'booth',
    mode: 'attending',
    speakers: [],
    location: 'Sankt Augustin',
    date: exact('2026-08-15'),
    ...overrides,
  });
}

function mczEvent(overrides: EventOverrides = {}): EventEntry {
  return event('my-coding-zone-should-i-get-or-should-i-post', {
    title: 'Should I GET or Should I POST — The Clash With HTTP Conformance',
    participation: 'livestream',
    mode: 'presenting',
    speakers: [TEAM_KEY],
    online: true,
    date: exact('2026-07-10'),
    attribution: GUEST_ATTRIBUTION,
    resourceUrl: 'https://www.youtube.com/watch?v=1IvUSEnGkZ8',
    ...overrides,
  });
}

function webistEvent(overrides: EventOverrides = {}): EventEntry {
  return event('webist-research-paper', {
    title: 'WEBIST: Research Paper',
    participation: 'paper',
    mode: 'presenting',
    speakers: [],
    location: 'Angers, France',
    date: exact('2026-10-27'),
    ...overrides,
  });
}

function mczResource(overrides: ResourceOverrides = {}): ResourceEntry {
  return resource('should-i-get-or-should-i-post-recording', {
    title: 'Should I GET or Should I POST — The Clash With HTTP Conformance',
    resourceType: 'recorded talk',
    url: 'https://www.youtube.com/watch?v=1IvUSEnGkZ8',
    attribution: GUEST_ATTRIBUTION,
    originEvent: 'my-coding-zone-should-i-get-or-should-i-post',
    ...overrides,
  });
}

function eventInput(
  entry: EventEntry,
  eventsById: Map<string, EventEntry> = new Map(),
): PromoInput {
  return {
    subject: { kind: 'event', entry },
    eventsById,
    siteUrl: SITE_URL,
    buildDate: BUILD_DATE,
  };
}

function resourceInput(
  entry: ResourceEntry,
  eventsById: Map<string, EventEntry>,
): PromoInput {
  return {
    subject: { kind: 'resource', entry },
    eventsById,
    siteUrl: SITE_URL,
    buildDate: BUILD_DATE,
  };
}

function findPost(posts: PromoPost[], platform: PromoPlatform): PromoPost {
  const post = posts.find((p) => p.platform === platform);
  if (post === undefined) {
    throw new Error(`no post for platform "${platform}"`);
  }
  return post;
}

function firstBlock(post: PromoPost): PromoPostBlock {
  const block = post.blocks[0];
  if (block === undefined) {
    throw new Error(`post for platform "${post.platform}" has no blocks`);
  }
  return block;
}

function lastBlock(post: PromoPost): PromoPostBlock {
  const block = post.blocks[post.blocks.length - 1];
  if (block === undefined) {
    throw new Error(`post for platform "${post.platform}" has no blocks`);
  }
  return block;
}

// ---------------------------------------------------------------------------
// Module shape and purity (AC1)
// ---------------------------------------------------------------------------

describe('promo-platforms.ts — module shape (AC1)', () => {
  it('exports all four symbols with the pinned values', () => {
    expect(PROMO_PLATFORMS).toEqual(['reddit', 'x', 'linkedin', 'discord']);
    expect(PLATFORM_CHAR_LIMITS).toEqual({
      reddit: null,
      x: 280,
      linkedin: 3000,
      discord: 2000,
    });
    expect(Object.keys(PLATFORM_CHAR_LIMITS)).toEqual([...PROMO_PLATFORMS]);
    expect(REDDIT_TITLE_LIMIT).toBe(300);
  });
});

describe('composePromoPosts — determinism and purity (AC1)', () => {
  it('is deterministic: two calls with identical input return identical output', () => {
    const input = eventInput(apidaysEvent());
    expect(composePromoPosts(input)).toEqual(composePromoPosts(input));
  });

  it('never reads the real clock: only the injected buildDate affects timeframe', () => {
    const ev = event('flip', { date: exact('2026-06-15') });
    const early = resolvePromoFacts({
      ...eventInput(ev),
      buildDate: new Date('2026-01-01'),
    });
    const late = resolvePromoFacts({
      ...eventInput(ev),
      buildDate: new Date('2026-12-01'),
    });
    expect(early.timeframe).toBe('upcoming');
    expect(late.timeframe).toBe('past');
  });
});

// ---------------------------------------------------------------------------
// Return shape (AC2, AC7)
// ---------------------------------------------------------------------------

describe('composePromoPosts — return shape (AC2, AC7)', () => {
  const posts = composePromoPosts(eventInput(apidaysEvent()));

  it('returns exactly 4 posts, in PROMO_PLATFORMS order, with 5 blocks total (2,1,1,1)', () => {
    expect(posts).toHaveLength(4);
    expect(posts.map((p) => p.platform)).toEqual([...PROMO_PLATFORMS]);
    expect(posts.map((p) => p.blocks.length)).toEqual([2, 1, 1, 1]);
  });

  it('every block text is non-empty and not whitespace-only', () => {
    for (const post of posts) {
      for (const block of post.blocks) {
        expect(block.text.length).toBeGreaterThan(0);
        expect(block.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('pins charLimit per block: reddit [300,null], x 280, linkedin 3000, discord 2000', () => {
    expect(posts.map((p) => p.blocks.map((b) => b.charLimit))).toEqual([
      [REDDIT_TITLE_LIMIT, null],
      [280],
      [3000],
      [2000],
    ]);
  });

  it('pins the label tuple exactly', () => {
    expect(posts.map((p) => p.blocks.map((b) => b.label))).toEqual([
      ['Title', 'Post body'],
      [undefined],
      [undefined],
      [undefined],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Facts layer (AC3, AC4)
// ---------------------------------------------------------------------------

describe('resolvePromoFacts — facts layer (AC3, AC4)', () => {
  it('returns the exact apidays-shaped fact set', () => {
    const facts = resolvePromoFacts(eventInput(apidaysEvent()));
    expect(facts.dateDisplay).toBe('July 8, 2026');
    expect(facts.kindLabel).toBe('Talk');
    expect(facts.modeLabel).toBe('Presenting');
    expect(facts.place).toBe('Munich');
    expect(facts.guestCredit).toBeUndefined();
    expect(facts.participation).toBe('talk');
    expect(facts.mode).toBe('presenting');
    expect(facts.resourceType).toBeUndefined();
    expect(facts.mediaVerb).toBeUndefined();
    expect(facts.speakerNames).toEqual([TEAM_NAME]);
  });

  it('renders month precision as "Month YYYY"', () => {
    const facts = resolvePromoFacts(
      eventInput(event('m', { date: monthPrecision(2026, 9) })),
    );
    expect(facts.dateDisplay).toBe('September 2026');
  });

  it('renders tba precision as "Date TBA"', () => {
    const facts = resolvePromoFacts(eventInput(event('t', { date: tba })));
    expect(facts.dateDisplay).toBe('Date TBA');
  });

  it('resolves online:true to place "Online"', () => {
    const facts = resolvePromoFacts(
      eventInput(event('o', { online: true, location: undefined })),
    );
    expect(facts.place).toBe('Online');
  });

  it('resolves a physical location to that exact string', () => {
    const facts = resolvePromoFacts(
      eventInput(event('l', { location: 'Berlin' })),
    );
    expect(facts.place).toBe('Berlin');
  });

  it('resolves a speaker key to its blogAuthors display name, falling back to the key for an unknown one', () => {
    const known = resolvePromoFacts(
      eventInput(event('k', { speakers: [TEAM_KEY] })),
    );
    expect(known.speakerNames).toEqual([TEAM_NAME]);

    const unknown = resolvePromoFacts(
      eventInput(event('u', { speakers: ['notARealKey'] })),
    );
    expect(unknown.speakerNames).toEqual(['notARealKey']);
  });
});

// ---------------------------------------------------------------------------
// Outward link (AC5)
// ---------------------------------------------------------------------------

describe('resolvePromoFacts — outward link precedence (AC5)', () => {
  it('falls back to siteEntryUrl when no register/resource/external URL exists', () => {
    const facts = resolvePromoFacts(
      eventInput(event('none-links', { date: exact('2027-01-01') })),
    );
    expect(facts.primaryUrl).toBe('https://thymian.dev/events/');
  });

  it('an upcoming event with registerUrl uses that URL', () => {
    const facts = resolvePromoFacts(
      eventInput(
        event('reg', {
          date: exact('2027-01-01'),
          registerUrl: 'https://example.com/signup',
        }),
      ),
    );
    expect(facts.primaryUrl).toBe('https://example.com/signup');
  });

  it('a past event with resourceUrl uses that URL', () => {
    const facts = resolvePromoFacts(
      eventInput(
        event('res', {
          date: exact('2020-01-01'),
          resourceUrl: 'https://example.com/recording',
        }),
      ),
    );
    expect(facts.primaryUrl).toBe('https://example.com/recording');
  });

  it('an upcoming event with only resourceUrl falls through to siteEntryUrl (resolveEventLinks returns [])', () => {
    const facts = resolvePromoFacts(
      eventInput(
        event('upcoming-resource-only', {
          date: exact('2027-01-01'),
          resourceUrl: 'https://example.com/recording',
        }),
      ),
    );
    expect(facts.primaryUrl).toBe('https://thymian.dev/events/');
  });

  it("a guest event with no register/resource URL uses the guest attribution's externalUrl", () => {
    const facts = resolvePromoFacts(
      eventInput(mczEvent({ resourceUrl: undefined })),
    );
    expect(facts.primaryUrl).toBe(GUEST_ATTRIBUTION.externalUrl);
  });

  it('a resource always uses its own entry.data.url', () => {
    const eventsById = indexEventsById([mczEvent()]);
    const facts = resolvePromoFacts(resourceInput(mczResource(), eventsById));
    expect(facts.primaryUrl).toBe(
      'https://www.youtube.com/watch?v=1IvUSEnGkZ8',
    );
  });

  it('siteEntryUrl appears on reddit body / linkedin / discord when it differs from primaryUrl, never on x', () => {
    const posts = composePromoPosts(
      eventInput(
        event('diff-url', {
          date: exact('2027-01-01'),
          registerUrl: 'https://example.com/signup',
        }),
      ),
    );
    const siteEntryLine = 'https://thymian.dev/events/';

    expect(lastBlock(findPost(posts, 'reddit')).text).toContain(siteEntryLine);
    expect(lastBlock(findPost(posts, 'linkedin')).text).toContain(
      siteEntryLine,
    );
    expect(lastBlock(findPost(posts, 'discord')).text).toContain(siteEntryLine);
    expect(lastBlock(findPost(posts, 'x')).text).not.toContain(siteEntryLine);
  });
});

// ---------------------------------------------------------------------------
// Resource timeframe and date (AC6)
// ---------------------------------------------------------------------------

describe('resolvePromoFacts — resource timeframe & date (AC6)', () => {
  it('an origin event dated after buildDate yields timeframe "upcoming" with its display string', () => {
    const eventsById = indexEventsById([
      event('future', { date: exact('2027-05-01') }),
    ]);
    const facts = resolvePromoFacts(
      resourceInput(
        resource('r-future', { originEvent: 'future' }),
        eventsById,
      ),
    );
    expect(facts.timeframe).toBe('upcoming');
    expect(facts.dateDisplay).toBe('May 1, 2027');
  });

  it('an origin event in the past yields timeframe "past"', () => {
    const eventsById = indexEventsById([
      event('bygone', { date: exact('2020-01-01') }),
    ]);
    const facts = resolvePromoFacts(
      resourceInput(resource('r-past', { originEvent: 'bygone' }), eventsById),
    );
    expect(facts.timeframe).toBe('past');
  });

  it('no originEvent yields timeframe "past", dateDisplay undefined, and no date substring in any block', () => {
    const facts = resolvePromoFacts(
      resourceInput(resource('orphan'), new Map()),
    );
    expect(facts.timeframe).toBe('past');
    expect(facts.dateDisplay).toBeUndefined();

    const posts = composePromoPosts(
      resourceInput(resource('orphan'), new Map()),
    );
    const monthNames =
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;
    for (const post of posts) {
      for (const block of post.blocks) {
        expect(block.text).not.toMatch(monthNames);
      }
    }
  });

  it("a resource's place, modeLabel, participation and mode are all undefined", () => {
    const facts = resolvePromoFacts(
      resourceInput(resource('r-shape'), new Map()),
    );
    expect(facts.place).toBeUndefined();
    expect(facts.modeLabel).toBeUndefined();
    expect(facts.participation).toBeUndefined();
    expect(facts.mode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Per-platform contract & falsifiable gates (AC7)
// ---------------------------------------------------------------------------

describe('composePromoPosts — per-platform contract & falsifiable gates (AC7)', () => {
  const ev = apidaysEvent();
  const posts = composePromoPosts(eventInput(ev));
  const facts = resolvePromoFacts(eventInput(ev));

  const redditPost = findPost(posts, 'reddit');
  const redditTitleBlock = firstBlock(redditPost);
  const redditBody = lastBlock(redditPost).text;
  const xBody = firstBlock(findPost(posts, 'x')).text;
  const linkedinBody = firstBlock(findPost(posts, 'linkedin')).text;
  const discordBody = firstBlock(findPost(posts, 'discord')).text;

  it('reddit block 1 is within REDDIT_TITLE_LIMIT and contains no "http"', () => {
    expect(redditTitleBlock.text.length).toBeLessThanOrEqual(
      REDDIT_TITLE_LIMIT,
    );
    expect(redditTitleBlock.text).not.toContain('http');
  });

  it('the four bodies (reddit body, x, linkedin, discord) are pairwise different', () => {
    const bodies = [redditBody, xBody, linkedinBody, discordBody];
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        expect(bodies[i]).not.toBe(bodies[j]);
      }
    }
  });

  it("linkedin: body >280 chars (a richer subject actually uses LinkedIn's room), hashtag-only final line, no fence", () => {
    // apidays alone renders a lean ~211-char body — genuinely native, not
    // padded (Dev Notes: "a well-structured 400-character LinkedIn body
    // beats a padded 2,900"). A richer real-shaped subject (longer title,
    // longer location, a guest credit) legitimately fills more of LinkedIn's
    // room, which is what this bullet is checking.
    const richEvent = event('linkedin-rich', {
      title:
        'A Very Long And Fully Descriptive Conference Talk Title About HTTP Conformance Testing And Validation Strategies',
      participation: 'talk',
      mode: 'presenting',
      speakers: [TEAM_KEY],
      location:
        'A City With A Very Long And Descriptive Name, Somewhere In Europe',
      date: exact('2026-07-08'),
      attribution: GUEST_ATTRIBUTION,
    });
    const richBody = firstBlock(
      findPost(composePromoPosts(eventInput(richEvent)), 'linkedin'),
    ).text;

    expect(richBody.length).toBeGreaterThan(280);
    const lines = richBody.split('\n').filter((l) => l.length > 0);
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toMatch(/^#[A-Za-z0-9]+( #[A-Za-z0-9]+){2,4}$/);
    expect(richBody).not.toContain('```');
  });

  it("linkedin: the apidays-shaped body's title lands within the first ~210-character fold", () => {
    expect(linkedinBody.slice(0, 210)).toContain(ev.data.title);
  });

  it('x: body has no "#" and no "](", and its last content line is exactly primaryUrl', () => {
    expect(xBody).not.toContain('#');
    expect(xBody).not.toContain('](');
    const lines = xBody.split('\n').filter((l) => l.length > 0);
    expect(lines[lines.length - 1]).toBe(facts.primaryUrl);
  });

  it('discord: has >=1 Markdown construct and no hashtag-only line', () => {
    const lines = discordBody.split('\n');
    const hasMarkdown =
      discordBody.includes('**') ||
      lines.some((l) => l.startsWith('- ') || l.startsWith('> '));
    expect(hasMarkdown).toBe(true);
    expect(lines.some((l) => /^#[A-Za-z0-9]+(\s#[A-Za-z0-9]+)*$/.test(l))).toBe(
      false,
    );
  });

  it('neither the linkedin nor the discord body is a prefix of the other', () => {
    expect(linkedinBody.startsWith(discordBody)).toBe(false);
    expect(discordBody.startsWith(linkedinBody)).toBe(false);
  });

  it('golden-facts check: the linkedin body contains every apidays fact verbatim', () => {
    expect(linkedinBody).toContain(ev.data.title);
    expect(linkedinBody).toContain('Talk');
    expect(linkedinBody).toContain('Presenting');
    expect(linkedinBody).toContain('July 8, 2026');
    expect(linkedinBody).toContain('Munich');
    expect(linkedinBody).toContain(TEAM_NAME);
    expect(linkedinBody).toContain('https://thymian.dev/events/');
  });
});

// ---------------------------------------------------------------------------
// Phrasing (AC8)
// ---------------------------------------------------------------------------

describe('composePromoPosts — phrasing (AC8)', () => {
  it('booth/attending and talk/presenting yield different lede text for an otherwise identical entry', () => {
    const talkPosts = composePromoPosts(
      eventInput(
        event('e-talk', {
          participation: 'talk',
          mode: 'presenting',
          speakers: [],
        }),
      ),
    );
    const boothPosts = composePromoPosts(
      eventInput(
        event('e-booth', {
          participation: 'booth',
          mode: 'attending',
          speakers: [],
        }),
      ),
    );
    const talkX = firstBlock(findPost(talkPosts, 'x')).text;
    const boothX = firstBlock(findPost(boothPosts, 'x')).text;
    expect(talkX).not.toBe(boothX);
  });

  it('all 12 ParticipationType x ParticipationMode combinations compose without throwing, non-empty text', () => {
    for (const participation of PARTICIPATION_TYPES) {
      for (const mode of PARTICIPATION_MODES) {
        const posts = composePromoPosts(
          eventInput(
            event(`combo-${participation}-${mode}`, { participation, mode }),
          ),
        );
        for (const post of posts) {
          for (const block of post.blocks) {
            expect(block.text.trim().length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('resource verbs: paper -> Read the paper; recognised/unrecognised hosts pick the right verb', () => {
    expect(
      resolvePromoFacts(
        resourceInput(
          resource('paper-r', {
            resourceType: 'paper',
            url: 'https://example.com/paper.pdf',
          }),
          new Map(),
        ),
      ).mediaVerb,
    ).toBe('Read the paper');

    expect(
      resolvePromoFacts(
        resourceInput(
          resource('talk-yt', {
            resourceType: 'recorded talk',
            url: 'https://www.youtube.com/watch?v=abc',
          }),
          new Map(),
        ),
      ).mediaVerb,
    ).toBe('Watch on YouTube');

    expect(
      resolvePromoFacts(
        resourceInput(
          resource('talk-unknown', {
            resourceType: 'recorded talk',
            url: 'https://example.com/video',
          }),
          new Map(),
        ),
      ).mediaVerb,
    ).toBe('Watch the recording');

    expect(
      resolvePromoFacts(
        resourceInput(
          resource('pod-unknown', {
            resourceType: 'podcast episode',
            url: 'https://example.com/ep1',
          }),
          new Map(),
        ),
      ).mediaVerb,
    ).toBe('Listen to the episode');
  });

  it('speakers: [] emits no speaker clause — no "undefined", no dangling "by "/"with " fragment', () => {
    const posts = composePromoPosts(eventInput(frosconEvent()));
    for (const post of posts) {
      for (const block of post.blocks) {
        expect(block.text).not.toContain('undefined');
        expect(block.text).not.toMatch(/\bby\s*$/m);
        expect(block.text).not.toMatch(/\bwith\s*$/m);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Limits (AC9)
// ---------------------------------------------------------------------------

describe('fitWithinLimit — drop plan, driven directly with synthetic clause lists (AC9)', () => {
  const clauses: PromoClause[] = [
    {
      role: 'title',
      text: 'A Fairly Long And Descriptive Title For This Test Case',
    },
    { role: 'lede', text: 'A short lede sentence about the appearance.' },
    { role: 'kind', text: 'Talk' },
    { role: 'mode', text: 'Presenting' },
    { role: 'date', text: 'July 8, 2026' },
    { role: 'place', text: 'A Specific Named Venue' },
    { role: 'guestCredit', text: 'Guest of My Coding Zone on YouTube' },
    { role: 'primaryUrl', text: 'https://example.com/watch?v=abc123' },
    {
      role: 'imageCredit',
      text: 'Credit line, licensed under CC BY-ND 3.0 DE (https://example.com/license).',
    },
  ];

  it('drops place, then mode, then date, in that order, and never removes guestCredit/primaryUrl/imageCredit', () => {
    const fullLen = fitWithinLimit(clauses, 100000).text.length;

    // Step 1: drop `place`.
    const afterPlace = fitWithinLimit(clauses, fullLen - 1);
    expect(afterPlace.clauses.some((c) => c.role === 'place')).toBe(false);
    expect(afterPlace.clauses.some((c) => c.role === 'mode')).toBe(true);
    expect(afterPlace.clauses.some((c) => c.role === 'date')).toBe(true);

    const noPlaceLen = fitWithinLimit(
      clauses.filter((c) => c.role !== 'place'),
      100000,
    ).text.length;

    // Step 2: drop `mode` too.
    const afterMode = fitWithinLimit(clauses, noPlaceLen - 1);
    expect(afterMode.clauses.some((c) => c.role === 'place')).toBe(false);
    expect(afterMode.clauses.some((c) => c.role === 'mode')).toBe(false);
    expect(afterMode.clauses.some((c) => c.role === 'date')).toBe(true);

    const noPlaceOrModeLen = fitWithinLimit(
      clauses.filter((c) => c.role !== 'place' && c.role !== 'mode'),
      100000,
    ).text.length;

    // Step 3: drop `date` too — title survives untouched at this point.
    const afterDate = fitWithinLimit(clauses, noPlaceOrModeLen - 1);
    expect(afterDate.clauses.some((c) => c.role === 'date')).toBe(false);
    expect(afterDate.clauses.some((c) => c.role === 'title')).toBe(true);

    for (const result of [afterPlace, afterMode, afterDate]) {
      expect(result.clauses.some((c) => c.role === 'guestCredit')).toBe(true);
      expect(result.clauses.some((c) => c.role === 'primaryUrl')).toBe(true);
      expect(result.clauses.some((c) => c.role === 'imageCredit')).toBe(true);
    }
  });

  it('truncates the title on a word boundary with a trailing … and a 40-char floor, never below it', () => {
    const titleClauses: PromoClause[] = [
      { role: 'title', text: 'Word '.repeat(80).trim() },
      { role: 'primaryUrl', text: 'https://example.com/x' },
    ];
    const result = fitWithinLimit(titleClauses, 90);
    const titleClause = result.clauses.find((c) => c.role === 'title');
    expect(titleClause).toBeDefined();
    expect(titleClause?.text.endsWith('…')).toBe(true);
    expect(titleClause?.text.length ?? 0).toBeGreaterThanOrEqual(40);
    expect(result.text.length).toBeLessThanOrEqual(90);
  });

  it('limit === null (reddit body) never runs a drop step', () => {
    const bodyClauses: PromoClause[] = [
      { role: 'lede', text: 'Lede.' },
      { role: 'kind', text: 'Talk' },
      { role: 'mode', text: 'Presenting' },
      { role: 'date', text: 'July 8, 2026' },
      { role: 'place', text: 'Munich' },
      { role: 'primaryUrl', text: 'https://example.com' },
    ];
    const result = fitWithinLimit(bodyClauses, null);
    expect(result.clauses).toEqual(bodyClauses);
    expect(result.text).toContain('Talk · Presenting · July 8, 2026 · Munich');
  });

  it('terminal arbitration: guestCredit + primaryUrl + a 400-char imageCredit together exceed the limit, and the limit loses', () => {
    const imageCredit = 'C'.repeat(400);
    const overloaded: PromoClause[] = [
      { role: 'title', text: 'Short Title' },
      { role: 'lede', text: 'A short lede.' },
      { role: 'kind', text: 'Talk' },
      { role: 'guestCredit', text: 'Guest of My Coding Zone on YouTube' },
      { role: 'primaryUrl', text: 'https://example.com/x' },
      { role: 'imageCredit', text: imageCredit },
    ];
    const result = fitWithinLimit(overloaded, 280);
    expect(result.text.length).toBeGreaterThan(280);
    expect(result.text).toContain('Guest of My Coding Zone on YouTube');
    expect(result.text).toContain('https://example.com/x');
    expect(result.text).toContain(imageCredit);
  });
});

describe('composePromoPosts — limits end-to-end (AC9)', () => {
  it('a 400-character title still yields an x block within 280, primaryUrl intact, title truncated (…, >=40 chars)', () => {
    const longTitle = 'Should I GET or Should I POST '.repeat(20).slice(0, 400);
    expect(longTitle.length).toBe(400);
    const ev = apidaysEvent({ title: longTitle });
    const facts = resolvePromoFacts(eventInput(ev));
    const posts = composePromoPosts(eventInput(ev));
    const xBlock = firstBlock(findPost(posts, 'x'));

    expect(xBlock.text.length).toBeLessThanOrEqual(280);
    expect(xBlock.text).toContain(facts.primaryUrl);
    const firstLine = xBlock.text.split('\n')[0] ?? '';
    expect(firstLine.endsWith('…')).toBe(true);
    expect(firstLine.length).toBeGreaterThanOrEqual(40);
  });

  it('a synthetic 400-character imageCredit on x forces terminal arbitration: over 280, but URL/guest credit/credit intact', () => {
    const imageCredit = 'X'.repeat(400);
    const facts = resolvePromoFacts(eventInput(mczEvent()));
    const posts = composePromoPosts({ ...eventInput(mczEvent()), imageCredit });
    const xBlock = firstBlock(findPost(posts, 'x'));

    expect(xBlock.text.length).toBeGreaterThan(280);
    expect(xBlock.charLimit).toBe(280);
    expect(xBlock.text).toContain(
      `Guest of ${facts.guestCredit?.externalHost} on ${facts.guestCredit?.platform}`,
    );
    expect(xBlock.text).toContain(facts.primaryUrl);
    expect(xBlock.text).toContain(imageCredit);
  });

  it('every block of every seed-shaped subject (5 Events + 1 Resource) is within its charLimit', () => {
    const events = [
      apidaysEvent(),
      frankenjsEvent(),
      frosconEvent(),
      mczEvent(),
      webistEvent(),
    ];
    const eventsById = indexEventsById(events);
    const subjects: PromoInput[] = [
      ...events.map((entry) => eventInput(entry, eventsById)),
      resourceInput(mczResource(), eventsById),
    ];

    for (const input of subjects) {
      const posts = composePromoPosts(input);
      for (const post of posts) {
        for (const block of post.blocks) {
          if (block.charLimit !== null) {
            expect(block.text.length).toBeLessThanOrEqual(block.charLimit);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Attribution (AC10)
// ---------------------------------------------------------------------------

describe('composePromoPosts / resolvePromoFacts — attribution (AC10)', () => {
  it("guest: every body block contains 'Guest of My Coding Zone on YouTube' verbatim; reddit's title block never does", () => {
    const posts = composePromoPosts(eventInput(mczEvent()));
    const credit = 'Guest of My Coding Zone on YouTube';

    expect(lastBlock(findPost(posts, 'reddit')).text).toContain(credit);
    expect(firstBlock(findPost(posts, 'x')).text).toContain(credit);
    expect(firstBlock(findPost(posts, 'linkedin')).text).toContain(credit);
    expect(firstBlock(findPost(posts, 'discord')).text).toContain(credit);
    expect(firstBlock(findPost(posts, 'reddit')).text).not.toContain(credit);
  });

  it('host and absent attribution: guestCredit is undefined and no block contains "Guest of"', () => {
    const hostFacts = resolvePromoFacts(eventInput(apidaysEvent()));
    expect(hostFacts.guestCredit).toBeUndefined();

    const posts = composePromoPosts(eventInput(apidaysEvent()));
    for (const post of posts) {
      for (const block of post.blocks) {
        expect(block.text).not.toContain('Guest of');
      }
    }
  });

  it('a guest subject with a 400-character title on x still keeps both the guest credit and primaryUrl', () => {
    const longTitle = 'Should I GET or Should I POST '.repeat(20).slice(0, 400);
    const ev = mczEvent({ title: longTitle });
    const facts = resolvePromoFacts(eventInput(ev));
    const posts = composePromoPosts(eventInput(ev));
    const xBlock = firstBlock(findPost(posts, 'x'));

    expect(xBlock.text).toContain(
      `Guest of ${facts.guestCredit?.externalHost} on ${facts.guestCredit?.platform}`,
    );
    expect(xBlock.text).toContain(facts.primaryUrl);
  });
});

// ---------------------------------------------------------------------------
// Licence notice (AC11)
// ---------------------------------------------------------------------------

const FROSCON_IMAGE_CREDIT =
  'FrosCon logo © FrOSCon e.V., licensed under CC BY-ND 3.0 DE (https://creativecommons.org/licenses/by-nd/3.0/de/).';

function assertNoCreditArtifacts(posts: PromoPost[]): void {
  for (const post of posts) {
    for (const block of post.blocks) {
      expect(block.text.endsWith('\n')).toBe(false);
      expect(block.text.trimEnd()).toBe(block.text);
      expect(block.text).not.toContain('undefined');
    }
  }
}

describe('composePromoPosts — imageCredit / licence notice (AC11)', () => {
  it('appears verbatim exactly once as the final line of the final block of all four posts', () => {
    const posts = composePromoPosts({
      ...eventInput(frosconEvent()),
      imageCredit: FROSCON_IMAGE_CREDIT,
    });
    for (const post of posts) {
      const finalBlock = lastBlock(post);
      const lines = finalBlock.text.split('\n');
      expect(lines[lines.length - 1]).toBe(FROSCON_IMAGE_CREDIT);
      expect(finalBlock.text.split(FROSCON_IMAGE_CREDIT).length - 1).toBe(1);
    }
    // Reddit's title block never carries it.
    expect(firstBlock(findPost(posts, 'reddit')).text).not.toContain(
      FROSCON_IMAGE_CREDIT,
    );
  });

  it('the real 113-character FrosCon notice still leaves every block within its charLimit', () => {
    expect(FROSCON_IMAGE_CREDIT.length).toBe(113);
    const posts = composePromoPosts({
      ...eventInput(frosconEvent()),
      imageCredit: FROSCON_IMAGE_CREDIT,
    });
    for (const post of posts) {
      for (const block of post.blocks) {
        if (block.charLimit !== null) {
          expect(block.text.length).toBeLessThanOrEqual(block.charLimit);
        }
      }
    }
  });

  it('omitted imageCredit adds no clause, no placeholder, no trailing blank line', () => {
    assertNoCreditArtifacts(composePromoPosts(eventInput(frosconEvent())));
  });

  it('empty-string imageCredit behaves the same as omitted', () => {
    assertNoCreditArtifacts(
      composePromoPosts({ ...eventInput(frosconEvent()), imageCredit: '' }),
    );
  });

  it('whitespace-only imageCredit behaves the same as omitted', () => {
    assertNoCreditArtifacts(
      composePromoPosts({ ...eventInput(frosconEvent()), imageCredit: '   ' }),
    );
  });

  it('ordering: on x the credit follows primaryUrl; on linkedin it follows the hashtag line', () => {
    const facts = resolvePromoFacts(eventInput(apidaysEvent()));
    const posts = composePromoPosts({
      ...eventInput(apidaysEvent()),
      imageCredit: FROSCON_IMAGE_CREDIT,
    });

    const xLines = firstBlock(findPost(posts, 'x')).text.split('\n');
    expect(xLines[xLines.length - 2]).toBe(facts.primaryUrl);
    expect(xLines[xLines.length - 1]).toBe(FROSCON_IMAGE_CREDIT);

    const linkedinLines = firstBlock(findPost(posts, 'linkedin')).text.split(
      '\n',
    );
    expect(linkedinLines[linkedinLines.length - 1]).toBe(FROSCON_IMAGE_CREDIT);
    expect(linkedinLines[linkedinLines.length - 2]).toMatch(
      /^#[A-Za-z0-9]+( #[A-Za-z0-9]+){2,4}$/,
    );
  });
});

// ---------------------------------------------------------------------------
// Edge cases (AC12)
// ---------------------------------------------------------------------------

describe('composePromoPosts — an Event with no linked Resource (AC12)', () => {
  it('composes fully with an empty eventsById Map; no resource lookup is attempted', () => {
    const posts = composePromoPosts(eventInput(apidaysEvent(), new Map()));
    expect(posts).toHaveLength(4);
    for (const post of posts) {
      for (const block of post.blocks) {
        expect(block.text.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AD-6 guard (AC13)
// ---------------------------------------------------------------------------

describe('resolvePromoFacts / composePromoPosts — AD-6 guard (AC13)', () => {
  it('throws with AD-6 in the message for a set-but-dangling originEvent', () => {
    expect(() =>
      composePromoPosts(
        resourceInput(
          resource('ghost', { originEvent: 'nonexistent' }),
          new Map(),
        ),
      ),
    ).toThrow(/AD-6/);
  });

  it('does not throw when originEvent is unset', () => {
    expect(() =>
      composePromoPosts(resourceInput(resource('no-origin'), new Map())),
    ).not.toThrow();
  });
});
