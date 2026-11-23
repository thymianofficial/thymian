import { describe, expect, it } from 'vitest';

import {
  createLintExecution,
  createTestCaseExecution,
  createTestStep,
  isListedExecution,
} from '../src/report/index.js';

const step = createTestStep({
  name: 'GET /launches',
  location: { type: 'custom', value: 'GET /launches' },
});

describe('isListedExecution', () => {
  it('counts a passed execution only', () => {
    expect(
      isListedExecution(
        createTestCaseExecution({
          name: 'case',
          status: { kind: 'passed' },
          steps: [step],
        }),
      ),
    ).toBe(false);
  });

  it('lists a rule-level notApplicable test case', () => {
    expect(
      isListedExecution(
        createTestCaseExecution({
          name: 'no applicable transaction',
          status: { kind: 'notApplicable', reason: 'Nothing applies.' },
        }),
      ),
    ).toBe(true);
  });

  it('lists a notApplicable lint execution', () => {
    expect(
      isListedExecution(
        createLintExecution({
          location: { type: 'custom', value: 'input' },
          status: { kind: 'notApplicable' },
          findings: [],
        }),
      ),
    ).toBe(true);
  });

  it('lists a case-level notApplicable that carries a reason', () => {
    expect(
      isListedExecution(
        createTestCaseExecution({
          name: 'case',
          status: {
            kind: 'notApplicable',
            reason: "The live pair is outside the rule's applicability.",
          },
          steps: [step],
        }),
      ),
    ).toBe(true);
  });

  it('counts a case-level notApplicable without a reason only', () => {
    expect(
      isListedExecution(
        createTestCaseExecution({
          name: 'case',
          status: { kind: 'notApplicable' },
          steps: [step],
        }),
      ),
    ).toBe(false);
  });
});
