import { writeFile } from 'node:fs/promises';
import { format, join } from 'node:path';

import { BaseCliRunCommand, oclif, prompts } from '@thymian/cli-common';
import {
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';
import launchEditor from 'launch-editor';

import {
  afterEachRequestHook,
  authorizeHook,
  beforeEachRequestHook,
} from '../../../templates.js';

export default class GenerateHook extends BaseCliRunCommand<
  typeof GenerateHook
> {
  static override aliases = ['sampler:hooks:g', 'sampler:h:g'];

  override async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      const thymianFormat = await this.thymian.loadFormat();

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

      const transaction = titleToTransaction.get(result);

      if (transaction) {
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
          const answer = await prompts.confirm({
            message: `Do you want to generate a hook file at ${path}?`,
            default: true,
          });

          if (answer) {
            const choice = await prompts.select<
              'Before each request' | 'After each response' | 'Authorize'
            >({
              message: 'When do you want to execute the hook?',
              choices: [
                'Before each request',
                'After each response',
                'Authorize',
              ],
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

            this.log(
              oclif.ux.colorize('green', 'Hook generated successfully!'),
            );

            const openInEditor = await prompts.confirm({
              message: `Do you want to open the file in your editor now?`,
              default: true,
            });

            if (openInEditor) {
              launchEditor(fullFilePath, 'webstorm', (_, errorMessage) => {
                if (errorMessage) {
                  this.error(errorMessage);
                }

                this.log('Opening file in editor.');
              });
            }
          }
        }
      }
    });
  }
}
