import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import type {
  ConvertedRunFragment,
  CoreReportConvertInput,
} from './actions/index.js';
import type { ThymianEmitter } from './emitter/index.js';
import type { Logger } from './logger/logger.js';
import { ThymianBaseError } from './thymian.error.js';

/**
 * Shared helpers for `core.report.convert` claimants (ADR-0016/0017): every
 * plugin that claims a `--report` input type repeats the same listener
 * skeleton and the same file-boundary handling. Owning both here keeps
 * claimants consistent — the same command must answer the same file boundary
 * (BOM, path resolution, error wording) the same way for every input type.
 */

/**
 * Reads and JSON-parses a typed report input file with the shared boundary
 * semantics every claimant needs: relative locations resolve against `cwd`,
 * a UTF-8 BOM is tolerated (common for files saved by Windows editors —
 * `JSON.parse` rejects it with a misleading syntax error otherwise), and
 * read/parse failures are wrapped as {@link ThymianBaseError}s naming the
 * offending input so they trace back to the CLI argument.
 *
 * @param inputLabel the input's identity (`type:location`), used in every
 *   error message.
 * @param kind human-readable file kind for error messages, e.g.
 *   `"Thymian report"` or `"Spectral report"`.
 * @throws {ThymianBaseError} if the file is unreadable or not valid JSON.
 */
export async function readTypedInputJson(
  location: string,
  inputLabel: string,
  cwd: string,
  kind: string,
): Promise<unknown> {
  const filePath = isAbsolute(location) ? location : join(cwd, location);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new ThymianBaseError(
      `Failed to read ${kind} "${inputLabel}" (resolved to ${filePath}).`,
      { cause: err instanceof Error ? err : undefined },
    );
  }

  try {
    return JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (err) {
    throw new ThymianBaseError(
      `Failed to parse ${kind} "${inputLabel}" as JSON.`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}

/** One claimed report input, with its stringified location and identity tag. */
export interface ClaimedReportInput {
  location: string;
  /** The input's identity (`type:location`) for error messages and logs. */
  inputLabel: string;
}

/**
 * Registers a `core.report.convert` claim for one report-input `type`,
 * owning the listener skeleton every claimant repeats: filter the broadcast
 * inputs down to the claimed type, reply `[]` when nothing matches (the
 * collect strategy waits for every registered listener — 14.1 listener
 * contract), stringify each input's location for the fragment identity tag,
 * and reply the produced fragments. Errors thrown by `convert` propagate as
 * workflow failures (the intended tool/runtime error semantics) — never a
 * silently dropped input.
 */
export function registerReportInputClaim(
  emitter: ThymianEmitter,
  logger: Logger,
  options: {
    type: string;
    /** Logged when the broadcast contains no input of the claimed type. */
    idleMessage: string;
    convert: (
      inputs: ClaimedReportInput[],
      action: CoreReportConvertInput,
    ) => Promise<ConvertedRunFragment[]>;
  },
): void {
  emitter.onAction('core.report.convert', async (input, ctx) => {
    const claimed = input.inputs
      .filter((reportInput) => reportInput.type === options.type)
      .map((reportInput) => {
        const location = String(reportInput.location);
        return { location, inputLabel: `${options.type}:${location}` };
      });

    if (claimed.length === 0) {
      logger.info(options.idleMessage);
      ctx.reply([]);
      return;
    }

    ctx.reply(await options.convert(claimed, input));
  });
}
