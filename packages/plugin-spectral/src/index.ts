import type { ConvertedRunFragment, ThymianPlugin } from '@thymian/core';
import {
  createToolRun,
  registerReportInputClaim,
  ThymianFormat,
} from '@thymian/core';

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
      // The listener skeleton and file boundary live in core's
      // registerReportInputClaim/readTypedInputJson, shared by every claimant.
      registerReportInputClaim(emitter, logger, {
        type: 'spectral',
        idleMessage: 'No spectral report inputs found, nothing to convert.',
        convert: async (inputs, action) => {
          const format = action.format
            ? ThymianFormat.import(action.format)
            : undefined;

          const fragments: ConvertedRunFragment[] = [];

          for (const { location, inputLabel } of inputs) {
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
              input: { type: 'spectral', location },
              run: createToolRun({
                tool: { name: pluginName },
                runType: 'lint',
                executions,
                rules: rules.length > 0 ? rules : undefined,
                thymianFormatVersion: action.format?.attributes.hash,
              }),
            });
          }

          return fragments;
        },
      });
    },
  };
}

export const spectralPlugin = createSpectralPlugin();

export default spectralPlugin;
