import { writeFile } from 'node:fs/promises';
import { format, join, relative } from 'node:path';

import { BaseCliRunCommand, oclif, prompts } from '@thymian/common-cli';
import {
  type Thymian,
  ThymianBaseError,
  type ThymianEmitter,
  type ThymianFormat,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';
import launchEditor from 'launch-editor';

import { resolveSamplerPaths } from '../sampler-paths.js';
import {
  afterEachRequestHook,
  authorizeHook,
  beforeEachRequestHook,
} from './templates.js';

export async function generateHook<
  T extends typeof oclif.Command = typeof oclif.Command,
>(
  thymian: Thymian,
  emitter: ThymianEmitter,
  command: BaseCliRunCommand<T>,
  cwd: string,
  validateSpecs: boolean,
  forTransaction?: string,
  loadedThymianFormat?: ThymianFormat,
): Promise<void> {
  const thymianFormat =
    loadedThymianFormat ??
    (await thymian.loadFormat({
      inputs: [],
      validateSpecs,
    }));

  const titleToTransaction = new Map<string, ThymianHttpTransaction>();

  for (const t of thymianFormat.getThymianHttpTransactions()) {
    titleToTransaction.set(
      thymianHttpTransactionToString(t.thymianReq, t.thymianRes),
      t,
    );
  }

  const transactions = [...titleToTransaction.keys()].map((title) => ({
    name: title,
    value: title,
  }));

  let transaction: ThymianHttpTransaction | undefined;

  if (!forTransaction) {
    const result = await prompts.search({
      message: 'For which transaction do you want to generate a hook?',
      source: (answersSoFar) => {
        if (typeof answersSoFar === 'undefined') {
          return transactions;
        }

        return transactions.filter((t) =>
          t.value.toLowerCase().includes(answersSoFar.toLowerCase()),
        );
      },
    });

    transaction = titleToTransaction.get(result);
  } else {
    transaction = thymianFormat.getThymianHttpTransactionById(forTransaction);
  }

  if (!transaction) {
    throw new ThymianBaseError('Invalid transaction selected.', {
      name: 'InvalidTransactionError',
      ref: 'https://thymian.dev/references/errors/invalid-transaction-error/',
    });
  }

  const path = await emitter.emitAction(
    'sampler.path-from-transaction',
    {
      transactionId: transaction.transactionId,
    },
    {
      strategy: 'first',
    },
  );

  if (path) {
    const relativePath = relative(cwd, path);

    const answer = await prompts.confirm({
      message: `Do you want to generate a hook file at ${oclif.ux.colorize('bold', oclif.ux.colorize('underline', relativePath))}?`,
      default: true,
    });

    if (answer) {
      const choice = await prompts.select<
        'Before each request' | 'After each response' | 'Authorize'
      >({
        message: 'When do you want to execute the hook?',
        choices: ['Before each request', 'After each response', 'Authorize'],
      });

      const fileName = Math.random().toString(36).slice(2, 7);
      const dir = join(path, '..');
      const suffix =
        choice === 'After each response'
          ? 'afterEach'
          : choice === 'Before each request'
            ? 'beforeEach'
            : 'authorize';

      const fullFilePath = format({
        dir,
        name: `${fileName}.${suffix}`,
        ext: '.ts',
      });

      if (choice === 'After each response') {
        await writeFile(fullFilePath, afterEachRequestHook);
      } else if (choice === 'Authorize') {
        await writeFile(fullFilePath, authorizeHook);
      } else {
        await writeFile(fullFilePath, beforeEachRequestHook);
      }

      // The honest message, not the old success line. This writes the v1
      // per-transaction hook shape (`<name>.beforeEach.ts` etc., next to the
      // sample it targets) — but 575.9 replaced v1 hook discovery wholesale
      // with a scan of `.thymian/sampler/hooks/` (`extractHooksFromDir`,
      // `read-samples-from-dir.ts`, always returns empty now), so a file
      // written here is never loaded by anything. "Hook generated
      // successfully!" was true of the write and false of the result: the
      // command still writes a template a user can copy from, but nothing
      // reads it from where it landed. Removing this command entirely is
      // 575.10's scope (the epic lists `generate-hook` among the commands it
      // removes); until then, this is the honest minimum — say so, and point
      // at the directory that is actually scanned.
      command.warn(
        `This file is written for reference only — it will not be loaded from here. ` +
          `Hooks are discovered from ${oclif.ux.colorize('bold', relative(cwd, resolveSamplerPaths(cwd).hooksDir))} now; ` +
          `move the exported hook into a file there (see @thymian/hooks).`,
      );

      const openInEditor = await prompts.confirm({
        message: `Do you want to open the file in your editor now?`,
        default: true,
      });

      if (openInEditor) {
        launchEditor(fullFilePath, 'webstorm', (_, errorMessage) => {
          if (errorMessage) {
            command.error(errorMessage);
          }

          command.log('Opening file in editor.');
        });
      }
    }
  }
}
