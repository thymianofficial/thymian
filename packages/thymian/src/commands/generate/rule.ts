import { writeFile } from 'node:fs/promises';
import { EOL } from 'node:os';
import { join, relative } from 'node:path';

import { ThymianBaseCommand } from '@thymian/common-cli';
import { Flags, ux } from '@thymian/common-cli/oclif';
import { checkbox, input, select } from '@thymian/common-cli/prompts';
import {
  type HttpParticipantRole,
  httpParticipantRoles,
  type JSONSchemaType,
  type RuleMeta,
  type RuleSeverity,
  type RuleType,
} from '@thymian/core';

function capitalizeFirstCharacter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function createRuleTemplate(meta: RuleMeta, cjs: boolean): string {
  const importStatement = cjs
    ? "const { httpRule } = require('@thymian/core')"
    : "import { httpRule } from '@thymian/core'";

  let template = `${importStatement};${EOL}${EOL}`;
  template += `${cjs ? 'module.exports =' : 'export default'} httpRule('${meta.name}')${EOL}`;

  if (meta.severity) {
    template += `  .severity('${meta.severity}')${EOL}`;
  }

  if (meta.type.length > 0) {
    template += `  .type(${meta.type.map((t) => `'${t}'`).join(', ')})${EOL}`;
  }

  if (meta.url) {
    template += `  .url('${meta.url.replaceAll("'", "\\'")}')${EOL}`;
  }

  if (meta.description) {
    template += `  .description('${meta.description.replaceAll("'", "\\'")}')${EOL}`;
  }

  if (meta.summary && meta.summary !== meta.description) {
    template += `  .summary('${meta.summary.replaceAll("'", "\\'")}')${EOL}`;
  }

  if (meta.appliesTo && meta.appliesTo.length > 0) {
    template += `  .appliesTo(${meta.appliesTo.map((r) => `'${r}'`).join(', ')})${EOL}`;
  }

  const isInformational =
    meta.type.length === 1 && meta.type[0] === 'informational';

  if (!isInformational) {
    template += `  .rule((context, options, logger) => {${EOL}`;
    template += `    // Implement your rule logic here${EOL}`;
    template += `  })${EOL}`;
  }

  template += `  .done();${EOL}`;

  return template;
}

export default class GenerateRule extends ThymianBaseCommand<
  typeof GenerateRule
> {
  static override description =
    'Scaffold a new HTTP rule using the httpRule builder.';

  static override examples = [
    '<%= config.bin %> generate rule',
    '<%= config.bin %> generate rule --prefix my-org/',
    '<%= config.bin %> generate rule --cjs',
    '<%= config.bin %> generate rule --output src/rules/my-rule.rule.ts',
  ];

  static override flags = {
    cjs: Flags.boolean({
      description: 'Generate rule using CommonJS syntax.',
      default: false,
    }),
    prefix: Flags.string({
      description: 'Prefix for the rule name that is automatically prepended.',
      default: '',
    }),
    url: Flags.string({
      description: 'Reference URL for the rule.',
    }),
    output: Flags.string({
      charAliases: ['o'],
      description:
        'Write the generated rule to a file instead of printing to stdout.',
    }),
    cwd: Flags.string({
      default: process.cwd(),
      description: 'Set current working directory.',
    }),
  };

  override async run(): Promise<void> {
    const name =
      this.flags.prefix +
      (await input({ message: 'What is the name of your rule?' }));

    const severity = await select<RuleSeverity>({
      message: 'What is the severity of your rule?',
      choices: [
        { name: 'error', value: 'error' },
        { name: 'warn', value: 'warn' },
        { name: 'hint', value: 'hint' },
      ],
    });

    const url =
      this.flags.url ??
      (await input({
        message: 'Reference URL (optional):',
        default: '',
      }));

    const description = await input({
      message: 'Description:',
      default: '',
    });

    const summary = await input({
      message: 'Summary:',
      default: '',
    });

    const ruleTypes = await checkbox<RuleType>({
      message: 'What are the types of your rule?',
      choices: [
        { name: 'lint', value: 'static' },
        { name: 'analyze', value: 'analytics' },
        { name: 'test', value: 'test' },
        { name: 'informational', value: 'informational' },
      ],
      required: true,
    });

    const appliesTo = await checkbox<HttpParticipantRole>({
      message:
        'To which communication participants does this rule apply? (optional)',
      choices: httpParticipantRoles.map((r) => ({
        name: r
          .split(' ')
          .map(capitalizeFirstCharacter)
          .join(' ')
          .split('-')
          .map(capitalizeFirstCharacter)
          .join('-'),
        value: r,
      })),
    });

    const ruleMeta: RuleMeta = {
      name,
      severity,
      type: ruleTypes,
      options: {} as JSONSchemaType<unknown>,
    };

    if (url) {
      ruleMeta.url = url.trim();
    }

    if (summary) {
      ruleMeta.summary = summary.trim();
    }

    if (description) {
      ruleMeta.description = description.trim();
    }

    if (appliesTo.length > 0) {
      ruleMeta.appliesTo = appliesTo;
    }

    const template = createRuleTemplate(ruleMeta, this.flags.cjs);

    if (this.flags.output) {
      const outputPath = join(this.flags.cwd, this.flags.output);
      await writeFile(outputPath, template, { encoding: 'utf-8' });
      this.log(
        `${ux.colorize('green', 'Rule written to')} ${relative(this.flags.cwd, outputPath)}`,
      );
    } else {
      this.log(template);
    }
  }
}
