import { join } from 'node:path';

import { BaseCliCommand } from '@thymian/cli-common';
import { Flags } from '@thymian/cli-common/oclif';

import type { RuleType } from '../../rule/rule-meta.js';
import type { RuleSeverity } from '../../rule/rule-severity.js';

export default class LintCommand extends BaseCliCommand<typeof LintCommand> {
  static override flags = {
    rules: Flags.string({
      multiple: true,
      default: [],
      description: 'Rules or rule sets to include.',
    }),
    severity: Flags.string({
      description: 'Rules or rule sets to include.',
      options: ['error', 'warn', 'hint'],
      default: 'hint',
    }),
    mode: Flags.string({
      multiple: true,
      default: ['static'],
      options: ['static', 'test', 'analytics'],
    }),
  };

  async run(): Promise<void> {
    await this.thymian.ready();

    const format = await this.thymian.loadFormat();

    if (this.flags.rules.length > 0) {
      await this.thymian.emitter.runHook('http-linter.load-rules', {
        rules: this.flags.rules.map((rule) => join(process.cwd(), rule)),
      });
    }

    const result = await this.thymian.emitter.runHook('http-linter.lint', {
      format: format.export(),
      severity: this.flags.severity as RuleSeverity,
      modes: this.flags.mode as RuleType[],
    });

    const valid = result.every((x) => x);

    await this.thymian.close();

    if (!valid) {
      this.exit(1);
    }
  }
}
