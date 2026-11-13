import { describe, expect, it } from 'vitest';

import {
  isRuleViolationGroupLocation,
  locateOnGroup,
  type RuleFnResult,
  type RuleViolationLocation,
} from '../../src/index.js';

const getUsers: RuleViolationLocation = {
  elementType: 'edge',
  elementId: 'get-users',
};
const headUsers: RuleViolationLocation = {
  elementType: 'edge',
  elementId: 'head-users',
};

function violationOn(location: RuleFnResult['location']): RuleFnResult {
  return { location, violation: { message: 'flagged' }, findings: [] };
}

describe('locateOnGroup', () => {
  it('locates a result on the group key on the group, naming its members', () => {
    expect(
      locateOnGroup([violationOn('/users')], '/users', [getUsers, headUsers]),
    ).toEqual([
      violationOn({
        elementType: 'group',
        key: '/users',
        members: [getUsers, headUsers],
      }),
    ]);
  });

  it('keeps a result on one member on that member', () => {
    expect(
      locateOnGroup([violationOn(headUsers)], '/users', [getUsers, headUsers]),
    ).toEqual([violationOn(headUsers)]);
  });

  it('keeps a result on any other string where the rule located it', () => {
    expect(
      locateOnGroup([violationOn('somewhere else')], '/users', [getUsers]),
    ).toEqual([violationOn('somewhere else')]);
  });

  it('names a member once, although the group holds it several times', () => {
    const [result] = locateOnGroup([violationOn('/users')], '/users', [
      getUsers,
      { ...getUsers, label: 'GET /users' },
      'an unmatched pair',
      'an unmatched pair',
    ]);

    expect(result?.location).toEqual({
      elementType: 'group',
      key: '/users',
      members: [getUsers, 'an unmatched pair'],
    });
  });

  it('gives the group a string key where the key it was handed is none', () => {
    const key = 200 as unknown as string;

    const [result] = locateOnGroup([violationOn(key)], key, [getUsers]);

    expect(result?.location).toMatchObject({
      elementType: 'group',
      key: '200',
    });
  });
});

describe('isRuleViolationGroupLocation', () => {
  it('tells a group from the locations a rule names', () => {
    expect(
      isRuleViolationGroupLocation({
        elementType: 'group',
        key: '/users',
        members: [],
      }),
    ).toBe(true);
    expect(isRuleViolationGroupLocation(getUsers)).toBe(false);
    expect(isRuleViolationGroupLocation('/users')).toBe(false);
  });
});
