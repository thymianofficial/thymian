import type { ConvertedRunFragment, ThymianPlugin } from '@thymian/core';
import { createToolRun, ThymianFormat } from '@thymian/core';

import { convertResults } from './convert.js';
import { loadSpectralReport } from './load-spectral-report.js';

export type { SpectralResult } from './spectral-types.js';

/**
 * `@thymian/plugin-spectral` converts pre-generated Spectral JSON output
 * (`spectral lint -f json`) into canonical Thymian lint runs. It never
 * executes Spectral — the input is the report file. See
 * {@link SpectralResult} for the supported input format.
 *
 * The plugin extends `thymian report convert` purely by listening on the
 * core-owned `core.report.convert` collect action (ADR-0016/0017): it claims
 * `spectral`-typed report inputs and replies one lint `ToolRun` per claimed
 * input, tagged with that input's identity. The converted report kind is
 * always `lint`.
 */
export function createSpectralPlugin(
  pluginName = '@thymian/plugin-spectral',
): ThymianPlugin {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.report.convert'],
    },
    async plugin(emitter, logger, options) {
      emitter.onAction('core.report.convert', async (input, ctx) => {
        const spectralInputs = input.inputs.filter(
          (reportInput) => reportInput.type === 'spectral',
        );

        // Always reply, even with nothing claimed — the collect strategy
        // waits for every registered listener (14.1 listener contract).
        if (spectralInputs.length === 0) {
          logger.info('No spectral report inputs found, nothing to convert.');
          ctx.reply([]);
          return;
        }

        const format = input.format
          ? ThymianFormat.import(input.format)
          : undefined;

        const fragments: ConvertedRunFragment[] = [];

        for (const reportInput of spectralInputs) {
          const location = String(reportInput.location);
          const inputLabel = `${reportInput.type}:${location}`;

          logger.info(`Converting Spectral report: ${location}`);

          // Failures propagate as thrown ThymianBaseErrors — the intended
          // tool/runtime error semantics; never a silently dropped input.
          const results = await loadSpectralReport(
            location,
            inputLabel,
            options.cwd,
          );

          const { executions, rules } = convertResults(results, {
            logger,
            format,
          });

          fragments.push({
            // Tag with the stringified input identity — core derives claim
            // coverage by exact type + String(location) match.
            input: { type: reportInput.type, location },
            run: createToolRun({
              tool: { name: pluginName },
              runType: 'lint',
              executions,
              rules: rules.length > 0 ? rules : undefined,
              thymianFormatVersion: input.format?.attributes.hash,
            }),
          });
        }

        ctx.reply(fragments);
      });
    },
  };
}

export const spectralPlugin = createSpectralPlugin();

export default spectralPlugin;
