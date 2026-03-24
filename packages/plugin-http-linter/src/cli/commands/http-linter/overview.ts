import { BaseCliRunCommand } from '@thymian/cli-common';
import type { RuleSeverity, RuleType } from '@thymian/core';

export default class Overview extends BaseCliRunCommand<typeof Overview> {
  static override description =
    'Show a more detailed overview of all loaded rules.';

  async run(): Promise<void> {
    await this.thymian.run(async () => {
      const rules = (
        await this.thymian.emitter.emitAction('http-linter.rules')
      ).flat();

      const overview: Record<
        RuleType,
        Record<Exclude<RuleSeverity, 'off'>, number>
      > = {
        static: {
          hint: 0,
          warn: 0,
          error: 0,
        },
        analytics: {
          hint: 0,
          warn: 0,
          error: 0,
        },
        test: {
          hint: 0,
          warn: 0,
          error: 0,
        },
        informational: {
          hint: 0,
          warn: 0,
          error: 0,
        },
      };

      for (const { meta } of rules) {
        for (const ruleType of meta.type) {
          if (meta.severity !== 'off') {
            overview[ruleType][meta.severity]++;
          }
        }
      }

      console.table(overview);
      this.log(rules.length + ' rules loaded in total.');
    });
  }
}
