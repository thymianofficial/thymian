import { ux } from '@oclif/core';
import { describe, expect, it, vi } from 'vitest';

import {
  classificationToExitCode,
  handleWorkflowOutcome,
  HIGH_COUNT_THRESHOLD,
} from '../src/workflow-outcome.js';

vi.mock('@oclif/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@oclif/core')>();
  return {
    ...actual,
    ux: {
      ...actual.ux,
      stdout: vi.fn(),
    },
  };
});

function makeCommand() {
  return {
    exit: vi.fn(),
    guidance: vi.fn(),
  };
}

function makeViolations(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ruleName: `rfc9110/rule-${i}`,
    severity: 'error' as const,
    violation: { message: `violation ${i}` },
  }));
}

describe('workflow-outcome', () => {
  describe('classificationToExitCode', () => {
    it.each([
      ['clean-run', 0],
      ['findings', 1],
      ['tool-error', 2],
    ] as const)('maps %s to %d', (classification, exitCode) => {
      expect(classificationToExitCode(classification)).toBe(exitCode);
    });
  });

  describe('handleWorkflowOutcome', () => {
    it('writes report text to stdout and does not exit on clean run', () => {
      const command = makeCommand();

      handleWorkflowOutcome(command, {
        classification: 'clean-run',
        text: 'all good',
        results: [],
      });

      expect(ux.stdout).toHaveBeenCalledWith('all good');
      expect(command.exit).not.toHaveBeenCalled();
    });

    it.each([
      ['findings', 1],
      ['tool-error', 2],
    ] as const)('exits with %d for %s', (classification, exitCode) => {
      const command = makeCommand();

      handleWorkflowOutcome(command, {
        classification,
        results: [],
      });

      expect(command.exit).toHaveBeenCalledWith(exitCode);
    });
  });

  describe('post-report guidance (integrated into handleWorkflowOutcome)', () => {
    it('does not emit any guidance for clean-run', () => {
      const command = makeCommand();
      handleWorkflowOutcome(command, {
        classification: 'clean-run',
        results: [],
      });
      expect(command.guidance).not.toHaveBeenCalled();
    });

    it('does not emit any guidance for tool-error', () => {
      const command = makeCommand();
      handleWorkflowOutcome(command, {
        classification: 'tool-error',
        results: [],
      });
      expect(command.guidance).not.toHaveBeenCalled();
    });

    it('does not emit guidance for findings below high-count threshold', () => {
      const command = makeCommand();
      handleWorkflowOutcome(command, {
        classification: 'findings',
        results: [
          { source: 's', status: 'failed', violations: makeViolations(3) },
        ],
      });

      expect(command.guidance).not.toHaveBeenCalled();
    });

    it('emits guidance before exit is called', () => {
      const callOrder: string[] = [];
      const command = {
        exit: vi.fn(() => callOrder.push('exit')),
        guidance: vi.fn(() => callOrder.push('guidance')),
      };

      handleWorkflowOutcome(command, {
        classification: 'findings',
        results: [
          {
            source: 's',
            status: 'failed',
            violations: makeViolations(HIGH_COUNT_THRESHOLD + 1),
          },
        ],
      });

      expect(callOrder.indexOf('guidance')).toBeLessThan(
        callOrder.indexOf('exit'),
      );
    });

    it('does not emit high-count message when violations are at or below threshold', () => {
      const command = makeCommand();
      handleWorkflowOutcome(command, {
        classification: 'findings',
        results: [
          {
            source: 's',
            status: 'failed',
            violations: makeViolations(HIGH_COUNT_THRESHOLD),
          },
        ],
      });

      expect(command.guidance).not.toHaveBeenCalled();
    });

    it('emits high-count brownfield message when violations exceed threshold', () => {
      const command = makeCommand();
      handleWorkflowOutcome(command, {
        classification: 'findings',
        results: [
          {
            source: 's',
            status: 'failed',
            violations: makeViolations(HIGH_COUNT_THRESHOLD + 1),
          },
        ],
      });

      expect(command.guidance).toHaveBeenCalledTimes(1);
      expect(command.guidance).toHaveBeenCalledWith(
        expect.stringContaining(
          'Running Thymian on an existing API often surfaces many findings',
        ),
      );
    });

    it('high-count message includes actionable advice', () => {
      const calls: string[] = [];
      const command = {
        exit: vi.fn(),
        guidance: vi.fn((msg: string) => calls.push(msg)),
      };
      handleWorkflowOutcome(command, {
        classification: 'findings',
        results: [
          {
            source: 's',
            status: 'failed',
            violations: makeViolations(HIGH_COUNT_THRESHOLD + 5),
          },
        ],
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain('existing API');
      expect(calls[0]).toContain('Start with errors');
    });

    it('sums violations across multiple results', () => {
      const command = makeCommand();
      handleWorkflowOutcome(command, {
        classification: 'findings',
        results: [
          {
            source: 's1',
            status: 'failed',
            violations: makeViolations(15),
          },
          {
            source: 's2',
            status: 'failed',
            violations: makeViolations(10),
          },
        ],
      });

      // 15 + 10 = 25 > threshold (20), so high-count message emitted
      expect(command.guidance).toHaveBeenCalledTimes(1);
    });

    it('emits high-count message only once regardless of number of results', () => {
      const calls: string[] = [];
      const command = {
        exit: vi.fn(),
        guidance: vi.fn((msg: string) => calls.push(msg)),
      };
      handleWorkflowOutcome(command, {
        classification: 'findings',
        results: [
          {
            source: 's1',
            status: 'failed',
            violations: makeViolations(15),
          },
          {
            source: 's2',
            status: 'failed',
            violations: makeViolations(10),
          },
        ],
      });

      const highCountCalls = calls.filter((c) => c.includes('existing API'));
      expect(highCountCalls).toHaveLength(1);
    });
  });

  describe('HIGH_COUNT_THRESHOLD', () => {
    it('is 20', () => {
      expect(HIGH_COUNT_THRESHOLD).toBe(20);
    });
  });
});
