import { ux } from '@oclif/core';
import { describe, expect, it, vi } from 'vitest';

import {
  classificationToExitCode,
  handleWorkflowOutcome,
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
      const command = {
        exit: vi.fn(),
      };

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
      const command = {
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
