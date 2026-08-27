import { isAbsolute, join } from 'node:path';

import {
  type HttpRequestTemplate,
  type SerializedThymianFormat,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpTransaction,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';
import type {} from '@thymian/plugin-request-dispatcher';

import { generateSamplesForThymianFormat } from './generation/generate-samples-for-thymian-format.js';
import {
  generatedTypesToString,
  generateTypesForThymianFormat,
} from './hooks/generate-request-types.js';
import { HookRunner } from './hooks/hook-runner.js';
import { LoadGeneration } from './load-generation.js';
import { requestSampleToRequestTemplate } from './request-sample-to-request-template.js';
import { RequestSampler } from './request-sampler.js';
import { resolveSamplerPaths } from './sampler-paths.js';
import { getPathTransactionId } from './samples-structure/get-path-transaction-id.js';
import { readSamplesFromDirIfUsable } from './samples-structure/read-samples-from-dir.js';
import type { SamplesStructure } from './samples-structure/samples-tree-structure.js';
import { writeSamplesToDir } from './samples-structure/write-samples-to-dir.js';
import { TransactionCatalog } from './selectors/transaction-catalog.js';
import {
  type SamplerValidationReport,
  validateSamplerOutput,
} from './validation/validate-sampler-output.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'sampler.init': {
      event: {
        format: SerializedThymianFormat;
        overwrite?: boolean;
      };
      response: void;
    };

    'sampler.validate': {
      event: {
        format: SerializedThymianFormat;
        forPath?: string;
      };
      response: SamplerValidationReport;
    };

    'core.request.sample': {
      event: {
        transaction: ThymianHttpTransaction;
        options?: Record<string, unknown>;
      };
      response: HttpRequestTemplate;
    };

    'sampler.unknown-type': {
      event: {
        contentType: string;
        schema: ThymianSchema;
      };
      response: { $content: unknown; $encoding?: string };
    };

    'sampler.path-from-transaction': {
      event: {
        transactionId: string;
      };
      response: string | undefined;
    };
  }
}

export type SamplerPluginOptions = {
  path: string;
};

const samplerValidateActionSchema = {
  event: {
    type: 'object',
    required: ['format'],
    properties: {
      format: {},
      forPath: { type: 'string' },
    },
  },
  response: {
    type: 'object',
    required: ['samplePath', 'checkedArtifacts', 'failures'],
    properties: {
      samplePath: { type: 'string' },
      checkedArtifacts: { type: 'integer' },
      failures: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'path', 'message'],
          properties: {
            type: {
              type: 'string',
              enum: [
                'missing-artifact',
                'changed-artifact',
                'stale-root-metadata',
                'metadata-out-of-sync',
                'unexpected-artifact',
                'invalid-json',
              ],
            },
            path: { type: 'string' },
            message: { type: 'string' },
            expected: { type: 'string' },
            actual: { type: 'string' },
            changes: { type: 'array' },
          },
        },
      },
    },
  },
} as const;

export const samplePlugin: ThymianPlugin<Partial<SamplerPluginOptions>> = {
  name: '@thymian/plugin-sampler',
  version: '0.x',
  options: {
    // ### for reference documentation ###
    title: 'Plugin Options',
    description: 'Configuration options for the Sampler plugin',
    // ###################################
    type: 'object',
    properties: {
      path: {
        type: 'string',
        nullable: true,
      },
    },
  },
  actions: {
    provides: {
      'sampler.init': {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        event: {
          type: 'object',
          required: ['contentType', 'schema'],
          properties: {
            contentType: { type: 'string' },
            schema: {},
          },
        },
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        response: {
          type: 'object',
          required: ['contentType', 'schema'],
          properties: {
            contentType: { type: 'string' },
            schema: {},
          },
        },
      },
      // The strict `JSONSchemaType<T>` target can't be satisfied by this
      // hand-written `as const` schema (readonly literals + a deliberately
      // loose `format: {}`, which ajv validates at runtime). Suppress the
      // structural check the same way `sampler.init` does above, for parity.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      'sampler.validate': samplerValidateActionSchema,
    },
  },
  plugin: async (emitter, logger, options) => {
    let basePath = join(options.cwd, '.thymian', 'samples');

    if (options.path) {
      basePath = isAbsolute(options.path)
        ? options.path
        : join(options.cwd, options.path);
    }

    // Every v2 sampler path derives from this one helper (spec §2). `basePath`
    // above stays the **v1** samples tree: `sampler.path-from-transaction`,
    // `sampler init` and `sampler validate` still depend on it until 575.10.
    const samplerPaths = resolveSamplerPaths(options.cwd);

    let format: ThymianFormat | undefined;
    let samples: SamplesStructure | undefined;

    // One authority, shared by every dependent of a `core.format` load —
    // `requestSampler`, `hookRunner`, and the `samples` write in
    // `initializeSamplerAndHookRunner` below. See {@link LoadGeneration}'s
    // docblock: each dependent used to keep its own counter, bumped inside its
    // own `init`, which answers "did something interrupt *my* await" rather
    // than "is this still the newest `core.format` event" — the two diverge
    // exactly when one dependent's async work runs ahead of another's, which
    // the samples-tree read and `requestSampler.init` both do, ahead of
    // `hookRunner.init`, on every single load.
    const generation = new LoadGeneration();

    const requestSampler = new RequestSampler(generation);
    const hookRunner = new HookRunner(
      samplerPaths.hooksDir,
      async (request) => {
        return await emitter.emitAction(
          'core.request.dispatch',
          {
            request,
          },
          {
            strategy: 'first',
          },
        );
      },
      logger,
      generation,
    );

    async function initializeSamplerAndHookRunner(
      format: ThymianFormat,
      transactionCatalog: TransactionCatalog,
      token: number,
    ) {
      // Drop the previous format's state. The candidate has already proven
      // loadable enough to reach this point — see the `core.format` handler
      // below, which builds `transactionCatalog` and only then calls this —
      // so nothing here can still be undone by the candidate turning out to
      // be malformed. See {@link HookRunner.invalidate} and
      // {@link RequestSampler.invalidate}: idempotent, called together so
      // both components' visible state is dropped in one synchronous step,
      // rather than one clearing while the other still answers for the old
      // format.
      hookRunner.invalidate();
      requestSampler.invalidate();
      samples = undefined;

      // `sampler.path-from-transaction` only — removed in 575.10. Samples
      // themselves never come from here any more, and neither do hooks: v1 tree
      // hook discovery went away in 575.9. The read is guarded (#613) so a
      // leftover, empty or half-written tree cannot fail a run that needs no
      // tree; `sampler.path-from-transaction` then throws its own
      // `SamplesNotLoadedError` if something actually invokes it.
      //
      // This is the async step that runs *ahead* of both `requestSampler.init`
      // and `hookRunner.init`, and a slow read here — a large v1 tree, a
      // network filesystem — is exactly what let an older load's write land
      // after a newer load had already finished. The result is only installed
      // if `token` is still current: an older, slower load that loses the race
      // must not resurrect the tree a newer load already replaced (or dropped)
      // with its own.
      const samplesResult = await readSamplesFromDirIfUsable(basePath, logger);

      if (generation.isCurrent(token)) {
        samples = samplesResult;
      }

      await requestSampler.init(format, emitter, token);
      await hookRunner.init(format, transactionCatalog, token);
    }

    emitter.onAction('core.format', async (f, ctx) => {
      // Taken first, synchronously, before anything else this load does —
      // including `ThymianFormat.import` and the samples-tree read inside
      // `initializeSamplerAndHookRunner`. This is the one moment true arrival
      // order between two overlapping `core.format` events is still knowable;
      // every check downstream (in `requestSampler`, in `hookRunner`, and for
      // `samples` above) compares against this same token rather than each
      // re-deriving its own notion of "current" after its own share of the
      // async work, which is what let an older event's slow pre-init read
      // silently reinstate a stale format after a newer event had already
      // completed.
      const token = generation.start();

      const imported = ThymianFormat.import(f);

      // The selector index for the loaded format: one selector per
      // transaction. Built **before** `format` (or anything else) is
      // dropped — `TransactionCatalog.fromThymianFormat` throws by design on
      // a cross-source selector collision, and that throw is a property of
      // the *candidate* format, not of the tree or process on disk. Wiping
      // state first left a working dev server fully dark the moment a
      // reload's candidate had a collision: `format`,
      // `hookRunner`/`requestSampler`/`samples` were all cleared **before**
      // the build could fail, so a format that was merely rejected took down
      // everything that had been working seconds earlier, until a valid one
      // loaded. Building the catalog first — and not touching `format` until
      // after — makes a bad candidate a no-op instead of an outage.
      //
      // Deliberately NOT extended to the samples-tree read inside
      // `initializeSamplerAndHookRunner`. That read can also throw — a
      // `PathTraversalError`, AC 9's one read that is not allowed to degrade
      // — but that refusal is about the tree **on disk** right now, not a
      // defect in the candidate format, and round 4's test in this file
      // deliberately pins the opposite behaviour for it: state IS wiped. A
      // samples-tree escape is a live, ongoing problem, not a rejected
      // candidate; continuing to serve the previous, unrelated format around
      // it would hide that something is actively wrong right now.
      const transactionCatalog = TransactionCatalog.fromThymianFormat(imported);

      logger.debug(
        `Indexed ${transactionCatalog.size} transaction selector(s).`,
      );

      // `format` is assigned only **after** the load succeeds, and dropped
      // only once the catalog build above has proven the candidate loadable
      // this far. Assigning first left, on a failed reload, the new format
      // paired with the previous format's sample projection — so
      // `core.request.sample` passed its `if (!format)` guard and fell
      // through to the `SampleProjectionMissingTransactionError` below, the
      // one commented "unreachable by construction".
      format = undefined;

      await initializeSamplerAndHookRunner(imported, transactionCatalog, token);

      format = imported;

      ctx.reply();
    });

    emitter.onAction(
      'sampler.path-from-transaction',
      ({ transactionId }, ctx) => {
        if (!samples) {
          throw new ThymianBaseError('No samples are loaded.', {
            name: 'SamplesNotLoadedError',
            ref: 'https://thymian.dev/references/errors/samples-not-loaded-error/',
          });
        }

        ctx.reply(getPathTransactionId(transactionId, basePath, samples));
      },
    );

    emitter.onAction('sampler.init', async ({ format, overwrite }, ctx) => {
      const parsedFormat = ThymianFormat.import(format);

      const samples = await generateSamplesForThymianFormat(
        parsedFormat,
        emitter,
      );

      logger.debug('Generated samples for thymian format.');

      const generatedTypes = await generateTypesForThymianFormat(parsedFormat);

      logger.debug('Generated types for thymian format.');

      await writeSamplesToDir(samples, generatedTypes.keyToTransactionId, {
        path: basePath,
        mode: typeof overwrite === 'boolean' ? 'overwrite' : 'failIfExist',
        typeArtifacts: {
          typesContent: generatedTypesToString(generatedTypes),
        },
      });

      logger.debug(`Wrote samples at ${basePath}`);

      ctx.reply();
    });

    emitter.onAction('sampler.validate', async ({ format, forPath }, ctx) => {
      const parsedFormat = ThymianFormat.import(format);

      ctx.reply(
        await validateSamplerOutput({
          format: parsedFormat,
          emitter,
          samplePath: basePath,
          forPath,
        }),
      );
    });

    emitter.onAction('core.request.sample', async ({ transaction }, ctx) => {
      if (!format) {
        throw new ThymianBaseError('Format is not loaded.', {
          name: 'FormatNotLoadedError',
          ref: 'https://thymian.dev/references/errors/format-not-loaded-error/',
        });
      }

      const sample = requestSampler.sampleForTransaction(
        transaction.transactionId,
      );

      if (!sample) {
        // Unreachable by construction: the projection is built from the same format
        // the transaction was read from. Internal invariant, not a user-facing error.
        throw new ThymianBaseError(
          `Transaction "${transaction.transactionId}" is not in the sample projection built from the loaded format.`,
          { name: 'SampleProjectionMissingTransactionError' },
        );
      }

      ctx.reply(requestSampleToRequestTemplate(sample));
    });

    emitter.onAction('http-testing.beforeRequest', async (hook, ctx) => {
      ctx.reply(await hookRunner.beforeEachRequest(hook));
    });

    emitter.onAction('http-testing.afterResponse', async (hook, ctx) => {
      ctx.reply(await hookRunner.afterEachResponse(hook));
    });

    emitter.onAction('http-testing.authorize', async (hook, ctx) => {
      ctx.reply(await hookRunner.authorize(hook));
    });
  },
};

export default samplePlugin;
