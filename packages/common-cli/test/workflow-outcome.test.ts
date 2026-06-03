import { handleWorkflowOutcome } from '../src/workflow-outcome.js';
import { describe, expect, it, vi } from 'vitest';

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
          executions: [
            {
              location: { type: 'custom', value: 'exec' },
              findings: [
                {
                  id: 'finding-1',
                  kind: 'rule-violation',
                  ruleId: 'rule/id',
                  title: 'Finding',
                  severity: 'warn',
                  message: { text: 'Finding' },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(command.exit).toHaveBeenCalledWith(1);
  });
});
