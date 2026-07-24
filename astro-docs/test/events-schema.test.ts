import { describe, expect, it } from 'vitest';

import { attributionSchema } from '../src/schema/attribution';
import { eventsSchema } from '../src/schema/events';
import { TEAM_KEYS } from '../src/schema/team-keys';

const aTeamKey = TEAM_KEYS[0] as string;
const anotherTeamKey = (TEAM_KEYS[1] ?? TEAM_KEYS[0]) as string;

const baseEvent = {
  title: 'Some Event',
  participation: 'talk' as const,
  mode: 'presenting' as const,
  location: 'Munich, Germany',
  date: { precision: 'exact' as const, date: '2026-09-15' },
};

describe('attributionSchema', () => {
  it('accepts a guest with externalHost + platform and no URL', () => {
    const r = attributionSchema.safeParse({
      hostGuest: 'guest',
      externalHost: 'My Coding Zone',
      platform: 'YouTube',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a guest missing externalHost/platform', () => {
    expect(attributionSchema.safeParse({ hostGuest: 'guest' }).success).toBe(
      false,
    );
  });

  it('rejects a guest with empty-string externalHost/platform', () => {
    const r = attributionSchema.safeParse({
      hostGuest: 'guest',
      externalHost: '   ',
      platform: '',
    });
    expect(r.success).toBe(false);
  });

  it('accepts a bare host', () => {
    expect(attributionSchema.safeParse({ hostGuest: 'host' }).success).toBe(
      true,
    );
  });

  it('rejects a host that carries external-host data (AD-13)', () => {
    const r = attributionSchema.safeParse({
      hostGuest: 'host',
      externalHost: 'Someone Else',
    });
    expect(r.success).toBe(false);
  });
});

describe('eventsSchema — speakers', () => {
  it('accepts an empty speakers array (booth case)', () => {
    const r = eventsSchema.safeParse({
      ...baseEvent,
      participation: 'booth',
      mode: 'attending',
      location: undefined,
      online: true,
      date: { precision: 'tba' },
      speakers: [],
    });
    expect(r.success).toBe(true);
  });

  it('accepts known team keys', () => {
    const r = eventsSchema.safeParse({ ...baseEvent, speakers: [aTeamKey] });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown speaker key on the speakers path', () => {
    const r = eventsSchema.safeParse({
      ...baseEvent,
      speakers: ['nobodyHere'],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('speakers'))).toBe(
        true,
      );
    }
  });

  it('rejects duplicate speaker keys', () => {
    const r = eventsSchema.safeParse({
      ...baseEvent,
      speakers: [aTeamKey, aTeamKey],
    });
    expect(r.success).toBe(false);
  });

  it('accepts two distinct known speakers', () => {
    const r = eventsSchema.safeParse({
      ...baseEvent,
      speakers: [aTeamKey, anotherTeamKey],
    });
    expect(r.success).toBe(anotherTeamKey !== aTeamKey);
  });
});

describe('eventsSchema — place XOR', () => {
  it('accepts a physical-only event', () => {
    const r = eventsSchema.safeParse({ ...baseEvent, location: 'Munich' });
    expect(r.success).toBe(true);
  });

  it('accepts an online-only event', () => {
    const r = eventsSchema.safeParse({
      ...baseEvent,
      location: undefined,
      online: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects both physical and online', () => {
    const r = eventsSchema.safeParse({
      ...baseEvent,
      location: 'Munich',
      online: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects neither physical nor online', () => {
    const r = eventsSchema.safeParse({ ...baseEvent, location: undefined });
    expect(r.success).toBe(false);
  });
});

describe('eventsSchema — participation type', () => {
  it('rejects a participation type outside the enum', () => {
    const r = eventsSchema.safeParse({
      ...baseEvent,
      participation: 'keynote',
    });
    expect(r.success).toBe(false);
  });
});
