import { EOL } from 'node:os';

import { Command, Flags } from '@thymian/cli-common/oclif';
import { checkbox, input, select } from '@thymian/cli-common/prompts';
import type { JSONSchemaType } from '@thymian/core';

import {
  type HttpParticipantRole,
  httpParticipantRoles,
  type RuleMeta,
  type RuleType,
} from '../../../rule/rule-meta.js';
import type { RuleSeverity } from '../../../rule/rule-severity.js';

export function capitalizeFirstCharacter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function createRuleTemplate(meta: RuleMeta, cjs: boolean): string {
  let template = `
${
  cjs
    ? "const { httpRule } = require('@thymian/http-linter')"
    : "import { httpRule } from '@thymian/http-linter'"
};

${cjs ? 'module.exports =' : 'export default'} httpRule('${meta.name}')
`;

  for (const [key, value] of Object.entries(meta) as [
    keyof RuleMeta,
    RuleMeta[keyof RuleMeta]
  ][]) {
    switch (key) {
      case 'name':
      case 'options':
        break;
      case 'tags':
      case 'type':
      case 'appliesTo': {
        if (Array.isArray(value)) {
          template += `  .${key}(${value
            .map((v) => `'${v}'`)
            .join(', ')})${EOL}`;
        }
        break;
      }
      case 'severity':
      case 'explanation':
      case 'description':
      case 'recommendation':
      case 'summary':
      case 'url':
        {
          if (typeof value === 'string') {
            template += `  .${key}('${value.replaceAll("'", "\\''")}')${EOL}`;
          }
        }
        break;
    }
  }

  return template + '  .done()' + EOL;
}

export default class Generate extends Command {
  static override flags = {
    cjs: Flags.boolean({
      description: 'Generate HTTP linter rule for CommonJs.',
      default: false,
    }),
    prefix: Flags.string({
      description: 'Prefix for the rule name that is automatically added.',
      default: '',
    }),
    url: Flags.string({
      description: 'Url for the rule.',
    }),
  };

  override async run(): Promise<void> {
    const { flags } = await this.parse(Generate);

    const name =
      flags.prefix +
      (await input({ message: 'What is the name of your rule?' }));

    const severity = await select<RuleSeverity>({
      message: 'What is the severity of your rule?',
      choices: ['error', 'warn', 'hint'],
    });

    const url =
      flags.url ??
      (await input({
        message: 'Url:',
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
      choices: ['static', 'analytics', 'test', 'informational'],
      required: true,
    });

    const appliesTo = await checkbox<HttpParticipantRole>({
      message: 'To which communication participants does this rule apply?',
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

    this.log(createRuleTemplate(ruleMeta, flags.cjs));
  }
}
