import { join } from 'node:path';

import { BaseCliRunCommand } from '@thymian/cli-common';
import { Flags } from '@thymian/cli-common/oclif';

import type { RuleType } from '../../rule/rule-meta.js';

export default class LintCommand extends BaseCliRunCommand<typeof LintCommand> {
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
    validate: Flags.boolean({
      description: 'Validate API description format(s) before linting.',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const valid = await this.thymian.run(async () => {
      const format = await this.thymian.loadFormat();

      if (this.flags.validate) {
        await this.thymian.emitter.emitAction('format-validator.validate', {
          format: format.export(),
        });
      }

      if (this.flags.rules.length > 0) {
        await this.thymian.emitter.emitAction('http-linter.load-rules', {
          rules: this.flags.rules.map((rule) => join(process.cwd(), rule)),
        });
      }

      return await this.thymian.emitter.emitAction(
        'http-linter.lint',
        {
          format: format.export(),
          //severity: this.flags.severity as RuleSeverity,
          modes: this.flags.mode as RuleType[],
        },
        {
          strategy: 'deep-merge',
        }
      );
    });

    if (!valid) {
      this.exit(1);
    }
  }
}
