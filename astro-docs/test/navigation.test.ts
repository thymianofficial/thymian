import { describe, expect, it } from 'vitest';

import { NAV_LINKS, resolveAriaCurrent } from '../src/data/navigation';

describe('NAV_LINKS', () => {
  it('has exactly 6 entries', () => {
    expect(NAV_LINKS).toHaveLength(6);
  });

  it('has the exact labels/hrefs/order/placement', () => {
    expect(NAV_LINKS.map((l) => [l.label, l.href, l.placement])).toEqual([
      ['Docs', '/introduction/what-is-thymian/', 'panel-only'],
      ['Events', '/events/', 'pills+panel'],
      ['Resources', '/resources/', 'pills+panel'],
      ['Blog', '/blog/', 'pills+panel'],
      ['Contact', 'mailto:support@thymian.dev', 'pills+panel'],
      ['Enterprise', '/enterprise/', 'pills+panel'],
    ]);
  });

  it('has exactly one isCta entry, and it is last', () => {
    const ctaEntries = NAV_LINKS.filter((l) => l.isCta);
    expect(ctaEntries).toHaveLength(1);
    expect(ctaEntries[0]?.label).toBe('Enterprise');
    expect(NAV_LINKS[NAV_LINKS.length - 1]?.label).toBe('Enterprise');
  });

  it('has Docs as the only panel-only entry', () => {
    const panelOnly = NAV_LINKS.filter((l) => l.placement === 'panel-only');
    expect(panelOnly.map((l) => l.label)).toEqual(['Docs']);
  });

  it('yields exactly Events, Resources, Blog, Contact, Enterprise in order for the pills+panel filter', () => {
    const pills = NAV_LINKS.filter((l) => l.placement === 'pills+panel');
    expect(pills.map((l) => l.label)).toEqual([
      'Events',
      'Resources',
      'Blog',
      'Contact',
      'Enterprise',
    ]);
  });
});

describe('resolveAriaCurrent', () => {
  it('returns "page" for an exact route match', () => {
    expect(resolveAriaCurrent('/events/', '/events/')).toBe('page');
  });

  it('returns "true" for a section/descendant match', () => {
    expect(resolveAriaCurrent('/events/', '/events/type/talk/')).toBe('true');
    expect(resolveAriaCurrent('/blog/', '/blog/some-post/')).toBe('true');
  });

  it('does not match a look-alike path sharing a prefix without a segment boundary', () => {
    expect(resolveAriaCurrent('/events/', '/eventsfoo/')).toBeUndefined();
  });

  it('normalizes trailing slashes on both sides', () => {
    expect(resolveAriaCurrent('/events', '/events/')).toBe('page');
    expect(resolveAriaCurrent('/events/', '/events')).toBe('page');
    expect(resolveAriaCurrent('/events', '/events/type/talk')).toBe('true');
  });

  it('never matches a mailto: link', () => {
    expect(
      resolveAriaCurrent('mailto:support@thymian.dev', '/events/'),
    ).toBeUndefined();
    expect(
      resolveAriaCurrent(
        'mailto:support@thymian.dev',
        'mailto:support@thymian.dev',
      ),
    ).toBeUndefined();
  });

  it('returns undefined for no match', () => {
    expect(resolveAriaCurrent('/enterprise/', '/')).toBeUndefined();
  });
});
