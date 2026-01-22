import { BaseCliRunCommand, oclif, prompts } from '@thymian/cli-common';
import { Flags } from '@thymian/cli-common/oclif';
import {
  isValidClientErrorStatusCode,
  isValidSuccessfulStatusCode,
  type ThymianEmitter,
  type ThymianFormat,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';
import {
  filterHttpTransactions,
  generateRequests,
  httpTest,
  mapToTestCase,
  runRequests,
} from '@thymian/http-testing';

import { createContext } from '../../../create-context.js';

export class Check extends BaseCliRunCommand<typeof Check> {
  static override flags = {
    incremental: Flags.boolean({
      allowNo: true,
      default: false,
    }),
  };

  private async checkAllTransaction(emitter: ThymianEmitter): Promise<void> {
    let successful = 0;
    let failed = 0;

    const format = await this.thymian.loadFormat({ emitFormat: true });

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

      const transactionName = thymianHttpTransactionToString(
        thymianReq,
        thymianRes,
      );

      this.logger.debug('Checking transaction: ' + transactionName);

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
          `Cannot execute transaction ${transactionName}: Test failed.`,
        );
      }

      const transaction = testCase.steps[0]?.transactions[0];

      if (!transaction) {
        throw new Error(`No step found for transaction ${transactionId}`);
      }

      if (
        testCase.status !== 'passed' ||
        transaction.response?.statusCode !== thymianRes.statusCode
      ) {
        this.log(`✖ ${transactionName}`);
        failed++;
      } else {
        this.log(`✔ ${transactionName}`);
        successful++;
      }
    }

    this.log();
    this.log(`Checked ${successful + failed} transactions. ${failed} failed.`);
  }

  private async checkTransactionsIncremental(
    emitter: ThymianEmitter,
  ): Promise<void> {
    const format = await this.thymian.loadFormat({ emitFormat: true });

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
        'Checking transaction: ' +
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

      if (
        testCase.status !== 'passed' ||
        transaction.response?.statusCode !== thymianRes.statusCode
      ) {
        this.log(
          oclif.ux.colorize(
            'red',
            `Cannot execute transaction ${thymianHttpTransactionToString(thymianReq, thymianRes)}: ${testCase.reason ?? `Expected status code ${thymianRes.statusCode}, got ${transaction.response?.statusCode}`}.`,
          ),
        );

        this.log('You can generate a hook for this transaction with:');
        this.log(
          `$ thymian sampler:hooks:generate --for-transaction= ${transactionId}`,
        );
        this.log();

        if (!this.config.findCommand('sampler:hooks:generate')) {
          this.debug(
            'Plugin @thymian/sampler is not installed. Skipping hook generation.',
          );
          return;
        }

        const answer = await prompts.confirm({
          message: `Do you want to create run "thymian sampler:hooks:generate --for-transaction= ${transactionId}" a hook to fix this?`,
          default: false,
        });

        if (answer) {
          await this.config.runCommand('sampler:hooks:generate', [
            '--for-transaction',
            transactionId,
          ]);
        }
      }
    }
  }

  override async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      if (this.flags.incremental) {
        await this.checkTransactionsIncremental(emitter);
      } else {
        await this.checkAllTransaction(emitter);
      }
    });
  }
}
