import { describe, expect, it } from 'vitest';

import { expandHttpParticipantRoles } from '../../src/rules/rule-meta.js';

describe('expandHttpParticipantRoles', () => {
  it('expands server to all server-side participant roles', () => {
    expect(expandHttpParticipantRoles(['server'])).toEqual(
      expect.arrayContaining([
        'server',
        'origin server',
        'cache',
        'proxy',
        'gateway',
        'tunnel',
        'intermediary',
      ]),
    );
    expect(expandHttpParticipantRoles(['server'])).toHaveLength(7);
  });

  it('does not expand server to client-side roles', () => {
    const expanded = expandHttpParticipantRoles(['server']);

    expect(expanded).not.toContain('client');
    expect(expanded).not.toContain('user-agent');
  });

  it('expands client to all client-side participant roles', () => {
    expect(expandHttpParticipantRoles(['client'])).toEqual([
      'client',
      'user-agent',
    ]);
  });

  it('expands intermediary to all intermediary roles', () => {
    expect(expandHttpParticipantRoles(['intermediary'])).toEqual(
      expect.arrayContaining(['intermediary', 'proxy', 'gateway', 'tunnel']),
    );
    expect(expandHttpParticipantRoles(['intermediary'])).toHaveLength(4);
  });

  it('keeps concrete roles unchanged', () => {
    expect(expandHttpParticipantRoles(['origin server'])).toEqual([
      'origin server',
    ]);
    expect(expandHttpParticipantRoles(['user-agent'])).toEqual(['user-agent']);
    expect(expandHttpParticipantRoles(['cache'])).toEqual(['cache']);
  });

  it('deduplicates roles covered by multiple expansions', () => {
    const expanded = expandHttpParticipantRoles(['server', 'proxy']);

    expect(expanded.filter((role) => role === 'proxy')).toHaveLength(1);
  });

  it('returns an empty list for no roles', () => {
    expect(expandHttpParticipantRoles([])).toEqual([]);
  });
});
