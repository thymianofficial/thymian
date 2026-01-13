import { BaseCliRunCommand, oclif, prompts } from '@thymian/cli-common';
import {
  isValidClientErrorStatusCode,
  isValidSuccessfulStatusCode,
  thymianHttpTransactionToString,
} from '@thymian/core';
import {
  filterHttpTransactions,
  generateRequests,
  httpTest,
  mapToTestCase,
  runRequests,
} from '@thymian/http-testing';
import type {} from '@thymian/request-dispatcher';

import { createContext } from '../../create-context.js';
import { generateHook } from '../../generate-hook.js';

export default class Init extends BaseCliRunCommand<typeof Init> {
  static override flags = {
    requests: oclif.Flags.boolean({
      default: true,
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      if (
        !this.thymian.plugins.find((p) => p.plugin.name === '@thymian/sampler')
      ) {
        this.error(
          'Cannot initialize sampler if sampler plugin is not registered.',
          {
            exit: 1,
          },
        );
      }

      const format = await this.thymian.loadFormat();

      await emitter.emitAction('sampler.init', {
        format: format.export(),
      });

      if (!this.flags.requests) {
        return;
      }

      for (const {
        thymianRes,
        thymianResId,
        transactionId,
        thymianReqId,
        thymianReq,
      } of format.getThymianHttpTransactions()) {
        if (
          !isValidSuccessfulStatusCode(thymianRes.statusCode) &&
          !isValidClientErrorStatusCode(thymianRes.statusCode)
        ) {
          continue;
        }

        this.logger.debug(
          'Running transaction: ' +
            thymianHttpTransactionToString(thymianReq, thymianRes),
        );

        const test = httpTest(
          thymianHttpTransactionToString(thymianReq, thymianRes),
          (transactions) =>
            transactions.pipe(
              filterHttpTransactions(
                (req, reqId) => reqId === thymianReqId,
                (res, resId) => resId === thymianResId,
              ),
              mapToTestCase(),
              generateRequests(),
              runRequests({ checkResponse: false }),
            ),
        );

        const context = createContext(
          format,
          this.logger.child('@thymian/http-testing'),
          emitter,
        );
        const testResults = await test(context);

        const testCase = testResults.cases[0];

        if (!testCase || !testCase.steps[0]) {
          throw new Error(
            `Cannot execute transaction ${thymianHttpTransactionToString(thymianReq, thymianRes)}: Test failed.`,
          );
        }

        const transaction = testCase.steps[0]?.transactions[0];

        if (!transaction) {
          throw new Error(`No step found for transaction ${transactionId}`);
        }

        if (transaction.response?.statusCode !== thymianRes.statusCode) {
          this.log(
            oclif.ux.colorize(
              'red',
              `Cannot execute transaction ${thymianHttpTransactionToString(thymianReq, thymianRes)}: Expected status code ${thymianRes.statusCode}, got ${transaction.response?.statusCode}.`,
            ),
          );

          const answer = await prompts.confirm({
            message: 'Do you want to create a hook to fix this?',
            default: false,
          });

          if (answer) {
            await generateHook(
              this.thymian,
              emitter,
              this,
              this.flags.cwd,
              transactionId,
              format,
            );
          }
        }
      }
    });

    this.log(oclif.ux.colorize('green', 'Sampler initialized.'));
  }
}
