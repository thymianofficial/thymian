import { describe, expect, it, vi } from 'vitest';

import {
  classificationToExitCode,
  handleWorkflowOutcome,
} from '../src/workflow-outcome.js';

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
    it('logs report text and does not exit on clean run', () => {
      const command = {
        log: vi.fn(),
        exit: vi.fn(),
      };

      handleWorkflowOutcome(command, {
        classification: 'clean-run',
        text: 'all good',
        results: [],
      });

      expect(command.log).toHaveBeenCalledWith('all good');
      expect(command.exit).not.toHaveBeenCalled();
    });

    it.each([
      ['findings', 1],
      ['tool-error', 2],
    ] as const)('exits with %d for %s', (classification, exitCode) => {
      const command = {
        log: vi.fn(),
        exit: vi.fn(),
      };

      handleWorkflowOutcome(command, {
        classification,
        results: [],
      });

      expect(command.exit).toHaveBeenCalledWith(exitCode);
    });
  });
});
