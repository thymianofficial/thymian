import { describe, expect, it } from 'vitest';

import { resourcesSchema } from '../src/schema/resources';

// `resourcesSchema` is a plain Zod object (no `image()` field), so it is parsed
// directly with `.safeParse(...)` — no `SchemaContext`/`image` fake is needed.
// `originEvent` uses Astro's `reference('events')`, whose dangling-id validation
// is a build/`astro sync` behavior, not a `safeParse` behavior; it is proven by
// a temporary build fixture, not exercised here.

const guestAttribution = {
  hostGuest: 'guest' as const,
  externalHost: 'My Coding Zone',
  platform: 'YouTube',
};

const baseResource = {
  title: 'Should I GET or should I POST?',
  resourceType: 'recorded talk' as const,
  url: 'https://youtube.com/watch?v=mycodingzone',
  embeddable: true,
  attribution: guestAttribution,
};

describe('resourcesSchema — valid entries', () => {
  it('accepts a valid recorded talk (embeddable, guest attribution, valid url)', () => {
    const r = resourcesSchema.safeParse(baseResource);
    expect(r.success).toBe(true);
  });

  it('accepts a valid paper (non-embeddable, host attribution)', () => {
    const r = resourcesSchema.safeParse({
      ...baseResource,
      title: 'A White Paper',
      resourceType: 'paper',
      url: 'https://example.com/paper.pdf',
      embeddable: false,
      attribution: { hostGuest: 'host' },
    });
    expect(r.success).toBe(true);
  });

  it('accepts an entry with originEvent omitted (optional)', () => {
    const r = resourcesSchema.safeParse(baseResource);
    expect(r.success).toBe(true);
  });
});

describe('resourcesSchema — resourceType enum (AD-2)', () => {
  it('rejects a resourceType outside the enum on the resourceType path', () => {
    const r = resourcesSchema.safeParse({
      ...baseResource,
      resourceType: 'blog post',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('resourceType'))).toBe(
        true,
      );
    }
  });
});

describe('resourcesSchema — attribution (AD-13)', () => {
  it('rejects a guest missing externalHost/platform', () => {
    const r = resourcesSchema.safeParse({
      ...baseResource,
      attribution: { hostGuest: 'guest' },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a host that carries external-host data', () => {
    const r = resourcesSchema.safeParse({
      ...baseResource,
      attribution: { hostGuest: 'host', externalHost: 'Someone Else' },
    });
    expect(r.success).toBe(false);
  });
});

describe('resourcesSchema — url (AD-12)', () => {
  it('rejects a missing url on the url path', () => {
    const r = resourcesSchema.safeParse({
      title: baseResource.title,
      resourceType: baseResource.resourceType,
      embeddable: baseResource.embeddable,
      attribution: baseResource.attribution,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('url'))).toBe(true);
    }
  });

  it('rejects a non-URL url on the url path', () => {
    const r = resourcesSchema.safeParse({
      ...baseResource,
      url: 'not a url',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('url'))).toBe(true);
    }
  });
});
