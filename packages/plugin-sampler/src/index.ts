import { mkdir, writeFile } from 'node:fs/promises';

import {
  type HttpRequestTemplate,
  ThymianFormat,
  type ThymianHttpTransaction,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';
import type {} from '@thymian/plugin-request-dispatcher';

import { generateTypeSurface } from './generation/types/generate-type-surface.js';
import {
  readGenerated,
  rootExcludeNote,
  scaffoldTsconfig,
  surfaceAsFiles,
  writeGenerated,
} from './generation/types/write-type-surface.js';
import {
  hookConflictError,
  unexportedHooksError,
  unresolvedHooksError,
} from './hooks/hook-diagnostics.js';
import { HookRunner } from './hooks/hook-runner.js';
import {
  loadUserHooks,
  type LoadUserHooksResult,
} from './hooks/load-user-hooks.js';
import { RequestSampler } from './request-sampler.js';
import { resolveSamplerPaths } from './sampler-paths.js';
import { TransactionCatalog } from './selectors/transaction-catalog.js';
import { entryExists } from './utils.js';
import {
  changedFiles,
  validateSampler,
  type ValidationReport as SamplerValidationReport,
} from './validation/validate-sampler.js';

declare module '@thymian/core' {
  interface ThymianActions {
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

    'sampler.show': {
      event: {
        selector: string;
      };
      response: {
        selector: string;
        request: HttpRequestTemplate;
      };
    };

    'sampler.sync': {
      event: {
        /** Report what would change and write nothing. The CI gate. */
        check?: boolean;
      };
      response: {
        /** Generated files whose **types** would change, or did. */
        changed: string[];
        /** Whether anything was written. */
        wrote: boolean;
        /**
         * Generated files whose **bytes** changed. A superset of `changed`: a
         * description edit rewrites a JSDoc comment without moving a type.
         */
        rewritten?: string[];
      };
    };

    'sampler.validate': {
      event: Record<string, never>;
      response: SamplerValidationReport;
    };

    'sampler.init': {
      event: Record<string, never>;
      response: {
        /** The sampler root, absolute. */
        root: string;
        /** Generated files written, relative to the root. */
        generated: string[];
        /** Whether a tsconfig was scaffolded, or one was already there. */
        tsconfig: 'written' | 'kept';
        /** What the user has to do to their own tsconfig, in their own words. */
        rootExcludeNote: string[];
      };
    };
  }
}

export type SamplerPluginOptions = {
  path: string;
};

export const samplePlugin: ThymianPlugin<Partial<SamplerPluginOptions>> = {
  name: '@thymian/plugin-sampler',
  version: '0.x',
  actions: {
    // What this plugin answers, what it asks for, and what it hands off. Kept
    // in step with the `onAction` calls below; `provides` stays empty because
    // the payload schemas would be hand-written duplicates of the types.
    listensOn: [
      'core.format',
      'core.close',
      'core.request.sample',
      'http-testing.beforeRequest',
      'http-testing.afterResponse',
      'http-testing.authorize',
      'sampler.show',
      'sampler.init',
      'sampler.sync',
      'sampler.validate',
    ],
    emits: ['sampler.unknown-type'],
  },
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
  plugin: async (emitter, logger, options) => {
    const paths = resolveSamplerPaths(options.cwd, options.path);

    const requestSampler = new RequestSampler();
    const hookRunner = new HookRunner(logger, {
      sampleRequest: async (transaction) =>
        await requestSampler.sampleForTransaction(transaction, emitter),
      dispatch: async (request) =>
        await emitter.emitAction(
          'core.request.dispatch',
          { request },
          { strategy: 'first' },
        ),
    });

    let catalog = TransactionCatalog.fromThymianFormat(new ThymianFormat());
    let unresolvedHooks: LoadUserHooksResult | undefined;

    /**
     * Refuse to start a run while a hook does not resolve.
     *
     * Checked here rather than when the format arrives, because a dangling
     * Selector must stop a *run* and not every command: `sampler validate` has
     * to survive long enough to report all of them, and `sampler show` and
     * `sampler sync` are not runs. This is the earliest run-only point — the
     * first request the tester asks the sampler to generate — so nothing is
     * sent before the diagnostic.
     */
    function assertHooksResolve(): void {
      if (!unresolvedHooks) {
        return;
      }

      if (unresolvedHooks.diagnostics.length > 0) {
        throw unresolvedHooksError(unresolvedHooks.diagnostics);
      }

      if (unresolvedHooks.conflicts.length > 0) {
        throw hookConflictError(unresolvedHooks.conflicts);
      }

      if (unresolvedHooks.unexported.length > 0) {
        throw unexportedHooksError(unresolvedHooks.unexported);
      }
    }

    emitter.onAction('core.format', async (serialized, ctx) => {
      const format = ThymianFormat.import(serialized);

      // Before the projection, so an ambiguous description fails at catalog
      // build rather than after generating samples nobody can address.
      catalog = TransactionCatalog.fromThymianFormat(format);

      const hooks = await loadUserHooks(paths.hooksDir, catalog);

      // Recorded, not thrown. A hook that does not resolve must fail the *run*
      // — see `assertHooksResolve` — but `sampler validate` exists to report
      // every such hook at once, and it cannot report anything if publishing
      // the format is what kills it.
      unresolvedHooks = hooks;

      for (const warning of hooks.warnings) {
        logger.warn(warning);
      }

      // The same non-breaking signal `validate` gives, at the point a run would
      // otherwise proceed silently against types that no longer describe the
      // API. Only when something is committed: with no `generated/` there is
      // nothing to be behind.
      const committed = await readGenerated(paths);

      if (Object.keys(committed).length > 0) {
        const stale = changedFiles(
          committed,
          await generateTypeSurface(catalog),
        );

        if (stale.length > 0) {
          logger.warn(
            `The committed sampler types are behind this API description (${stale.join(', ')}). Run "thymian sampler sync" and commit the result.`,
          );
        }
      }

      hookRunner.load(format, catalog, hooks);
      // After the hooks, because the sampler asks the runner to shape each
      // draft with its `defineSample` hook.
      await requestSampler.load(format, emitter, hookRunner.shapeSample);

      logger.debug(
        `Catalogued ${catalog.size} transactions, projected their request samples and loaded ${hooks.files.length} hook file(s) from ${paths.hooksDir}.`,
      );

      ctx.reply();
    });

    emitter.onAction('sampler.init', async (_event, ctx) => {
      await mkdir(paths.hooksDir, { recursive: true });

      const surface = await generateTypeSurface(catalog);

      await writeGenerated(paths, surface);

      // Scaffolded once and user-owned from then on: an existing one is kept
      // even if it no longer matches what this version would write.
      const hadTsconfig = await entryExists(paths.tsconfigPath);

      if (!hadTsconfig) {
        await writeFile(paths.tsconfigPath, scaffoldTsconfig(), 'utf-8');
      }

      ctx.reply({
        root: paths.root,
        generated: Object.keys(surfaceAsFiles(surface)).sort(),
        tsconfig: hadTsconfig ? 'kept' : 'written',
        rootExcludeNote: rootExcludeNote(paths, options.cwd),
      });
    });

    emitter.onAction('sampler.sync', async ({ check }, ctx) => {
      const surface = await generateTypeSurface(catalog);
      const changed = changedFiles(await readGenerated(paths), surface);

      if (check) {
        // Writes nothing, by contract: a CI gate that fixed the thing it was
        // checking would pass on the second run for the wrong reason.
        ctx.reply({ changed, wrote: false });

        return;
      }

      await mkdir(paths.hooksDir, { recursive: true });

      // Never the tsconfig: it is scaffolded once by `init` and the author's
      // from then on.
      const rewritten = await writeGenerated(paths, surface);

      ctx.reply({ changed, wrote: true, rewritten });
    });

    emitter.onAction('sampler.validate', async (_event, ctx) => {
      ctx.reply(await validateSampler(paths, catalog));
    });

    emitter.onAction('sampler.show', async ({ selector }, ctx) => {
      const transaction = catalog.resolve(selector);

      ctx.reply({
        selector,
        request: await requestSampler.sampleForTransaction(
          transaction,
          emitter,
        ),
      });
    });

    emitter.onAction('core.request.sample', async ({ transaction }, ctx) => {
      assertHooksResolve();

      ctx.reply(
        await requestSampler.sampleForTransaction(transaction, emitter),
      );
    });

    emitter.onAction('http-testing.beforeRequest', async (hook, ctx) => {
      assertHooksResolve();

      ctx.reply(await hookRunner.beforeEachRequest(hook));
    });

    emitter.onAction('http-testing.afterResponse', async (hook, ctx) => {
      ctx.reply(await hookRunner.afterEachResponse(hook));
    });

    emitter.onAction('http-testing.authorize', async (hook, ctx) => {
      ctx.reply(await hookRunner.authorize(hook));
    });

    emitter.onAction('core.close', async (_event, ctx) => {
      await hookRunner.close();

      ctx.reply();
    });
  },
};

export default samplePlugin;
