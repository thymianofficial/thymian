import { writeFile } from 'node:fs/promises';
import { EOL } from 'node:os';
import { extname, join, relative } from 'node:path';

import { ThymianBaseCommand, wrap } from '@thymian/common-cli';
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

/**
 * Extensions the default (ESM/TypeScript) template may be written to. This is a
 * deliberately tiny, local copy of the loader's rule — `@thymian/core`'s
 * `unloadableReason`/`LOADABLE_EXTENSIONS` are intra-package and not on the
 * public surface, so the generator cannot import them. The generator only ever
 * emits a subset of the loadable set `{.ts,.js,.mjs,.cjs}`: `.ts` by default
 * and `.cjs` under `--cjs`; it accepts an explicit `.js`/`.mjs` in default
 * mode. It never emits `.mts`/`.cts`.
 */
const ESM_OUTPUT_EXTENSIONS = new Set(['.ts', '.js', '.mjs']);

export type RuleOutputResolution =
  { ok: true; output: string } | { ok: false; reason: string };

/**
 * Resolve the final `--output` path for `generate rule`, enforcing that the
 * generator only ever emits a file the loader can actually load. On a
 * conflicting explicit extension it DECLINES with a framed reason rather than
 * silently rewriting the user's path; the only auto-fill is appending the
 * mode-correct extension when `--output` carries none. The returned `output` is
 * still relative to `--cwd` (the caller joins it).
 */
export function resolveRuleOutputPath(
  output: string,
  cjs: boolean,
): RuleOutputResolution {
  const ext = extname(output);

  // `.mts`/`.cts` are never loadable, in either mode (mirrors the loader).
  if (ext === '.mts' || ext === '.cts') {
    return {
      ok: false,
      reason: `"${ext}" is not a loadable extension — .mts/.cts are not supported for rules, rule sets, or plugins; use .ts instead.`,
    };
  }

  if (cjs) {
    if (ext === '.cjs') {
      return { ok: true, output };
    }
    if (ext === '') {
      return { ok: true, output: `${output}.cjs` };
    }
    return {
      ok: false,
      reason:
        `--cjs emits CommonJS (require/module.exports), which must be written to a .cjs file so a "type": "module" project cannot end up with require in a .js file. ` +
        `Use --output <name>.cjs (or omit the extension).`,
    };
  }

  // Default (ESM/TypeScript) mode.
  if (ext === '') {
    return { ok: true, output: `${output}.ts` };
  }
  if (ESM_OUTPUT_EXTENSIONS.has(ext)) {
    return { ok: true, output };
  }
  if (ext === '.cjs') {
    return {
      ok: false,
      reason:
        `"${ext}" cannot hold the generated ESM rule (export default) — a .cjs file is CommonJS. ` +
        `Use --cjs to emit CommonJS, or choose one of .ts, .js, .mjs.`,
    };
  }
  return {
    ok: false,
    reason: `"${ext}" is not a loadable extension for a generated rule — expected one of .ts, .js, .mjs (or .cjs with --cjs).`,
  };
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
    '<%= config.bin %> generate rule --cjs --output src/rules/my-rule.rule.cjs',
  ];

  static override flags = {
    cjs: Flags.boolean({
      description:
        'Generate rule using CommonJS syntax. With --output, the file is written as .cjs.',
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
      validate: (choices) =>
        choices.some((choice) => choice.value === 'informational') &&
        choices.length > 1
          ? "'informational' cannot be combined with other rule types."
          : true,
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
      const resolved = resolveRuleOutputPath(this.flags.output, this.flags.cjs);
      if (!resolved.ok) {
        this.error(resolved.reason, { exit: 1 });
      }
      const outputPath = join(this.flags.cwd, resolved.output);
      await writeFile(outputPath, template, { encoding: 'utf-8' });
      this.log(
        wrap(
          `${ux.colorize('green', 'Rule written to')} ${relative(this.flags.cwd, outputPath)}`,
        ),
      );
    } else {
      this.log(template);
    }
  }
}
