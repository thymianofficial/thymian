import { describe, expect, it, vi } from 'vitest';

import { handleWorkflowOutcome } from '../src/workflow-outcome.js';

describe('handleWorkflowOutcome', () => {
  it('renders the report and exits on non-clean outcomes', () => {
    const command = {
      exit: vi.fn(),
      guidance: vi.fn(),
    };

    handleWorkflowOutcome(command, {
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: 'tool' },
          runType: 'lint',
          runAt: new Date().toISOString(),
          rules: [{ id: 'rule/id', severity: 'warn' }],
          executions: [
            {
              kind: 'lint',
              ruleId: 'rule/id',
              status: { kind: 'failed', reason: 'Finding' },
              location: { type: 'custom', value: 'exec' },
              findings: [],
            },
          ],
        },
      ],
    });

    expect(command.exit).toHaveBeenCalledWith(1);
  });

  it('exits 0 on a run whose results are only notApplicable and passed', () => {
    const command = {
      exit: vi.fn(),
      guidance: vi.fn(),
    };

    handleWorkflowOutcome(command, {
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: 'tool' },
          runType: 'test',
          runAt: new Date().toISOString(),
          rules: [{ id: 'rule/id', severity: 'error' }],
          executions: [
            {
              kind: 'test',
              ruleId: 'rule/id',
              name: 'no applicable transaction',
              status: { kind: 'notApplicable', reason: 'nothing' },
              steps: [],
            },
            {
              kind: 'test',
              ruleId: 'rule/id',
              name: 'case',
              status: { kind: 'passed' },
              steps: [],
            },
          ],
        },
      ],
    });

    expect(command.exit).not.toHaveBeenCalled();
  });
});
