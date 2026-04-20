import { BaseCliRunCommand, oclif, prompts } from '@thymian/common-cli';
import { Flags } from '@thymian/common-cli/oclif';
import {
  filterHttpTransactions,
  generateRequests,
  httpTest,
  type HttpTestCase,
  isValidClientErrorStatusCode,
  isValidSuccessfulStatusCode,
  mapToTestCase,
  type RequestFilterFn,
  type ResponseFilterFn,
  runRequests,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';

import { createContext } from '../../create-context.js';

export default class Check extends BaseCliRunCommand<typeof Check> {
  static override description =
    'Verify that all sampled transactions can be executed against the live API.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --target-url http://localhost:8080',
    '<%= config.bin %> <%= command.id %> --incremental',
  ];

  static override flags = {
    incremental: Flags.boolean({
      allowNo: true,
      default: false,
      description:
        'Check transactions one by one and offer to generate hooks for failures.',
    }),
    ['target-url']: Flags.string({
      description:
        'Override the target URL for all check requests. When set, all requests are sent to this origin instead of the servers defined in the specification.',
    }),
  };

  override async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      const specifications = this.thymianConfig.specifications ?? [];

      const format = await this.thymian.loadFormat({
        inputs: specifications,
        validateSpecs: this.flags['validate-specs'],
      });

      const transactions = format.getThymianHttpTransactions();
      const targetUrl =
        this.flags['target-url'] ?? this.thymianConfig.targetUrl;

      const context = createContext(
        format,
        this.logger.child('sampler-check'),
        emitter,
      );

      if (this.flags.incremental) {
        await this.checkTransactionsIncremental(
          transactions,
          context,
          targetUrl,
        );
      } else {
        await this.checkAllTransactions(transactions, context, targetUrl);
      }
    });
  }

  private async checkAllTransactions(
    transactions: ThymianHttpTransaction[],
    context: ReturnType<typeof createContext>,
    targetUrl?: string,
  ): Promise<void> {
    let successful = 0;
    let failed = 0;

    for (const transaction of transactions) {
      if (!this.isCheckableTransaction(transaction)) {
        continue;
      }

      const transactionName = thymianHttpTransactionToString(
        transaction.thymianReq,
        transaction.thymianRes,
      );

      this.logger.debug('Checking transaction: ' + transactionName);

      const testResult = await this.runTransaction(
        transaction,
        context,
        targetUrl,
      );

      const testCase = testResult.cases[0];

      if (testCase && testCase.status === 'passed') {
        this.log(oclif.ux.colorize('green', `✔ ${transactionName}`));
        successful++;
      } else {
        this.log(oclif.ux.colorize('red', `✖ ${transactionName}`));
        this.logFailureDetails(testCase);
        this.log();
        failed++;
      }
    }

    this.log();

    if (failed > 0) {
      this.log(
        `Checked ${successful + failed} transactions. ${oclif.ux.colorize('red', `${failed} failed`)}.`,
      );
      this.exit(1);
    } else {
      this.log(
        oclif.ux.colorize(
          'green',
          `Checked ${successful + failed} transactions. All passed.`,
        ),
      );
    }
  }

  private async checkTransactionsIncremental(
    transactions: ThymianHttpTransaction[],
    context: ReturnType<typeof createContext>,
    targetUrl?: string,
  ): Promise<void> {
    for (const transaction of transactions) {
      if (!this.isCheckableTransaction(transaction)) {
        continue;
      }

      const transactionName = thymianHttpTransactionToString(
        transaction.thymianReq,
        transaction.thymianRes,
      );

      this.logger.debug('Checking transaction: ' + transactionName);

      const testResult = await this.runTransaction(
        transaction,
        context,
        targetUrl,
      );

      const testCase = testResult.cases[0];

      if (testCase && testCase.status === 'passed') {
        this.log(oclif.ux.colorize('green', `✔ ${transactionName}`));
        continue;
      }

      this.log(oclif.ux.colorize('red', `✖ ${transactionName}`));
      this.logFailureDetails(testCase);

      this.log();
      this.log('You can generate a hook for this transaction with:');
      this.log(
        `  $ thymian sampler generate hook --for-transaction ${transaction.transactionId}`,
      );
      this.log();

      if (!this.config.findCommand('sampler generate hook')) {
        this.debug(
          'Command sampler generate hook is not available. Skipping hook generation prompt.',
        );
        continue;
      }

      const answer = await prompts.confirm({
        message: 'Do you want to generate a hook to fix this transaction?',
        default: false,
      });

      if (answer) {
        await this.config.runCommand('sampler generate hook', [
          '--for-transaction',
          transaction.transactionId,
          '--cwd',
          this.flags.cwd,
          ...(this.flags.config ? ['-c', this.flags.config] : []),
        ]);
      }
    }
  }

  private isCheckableTransaction(transaction: ThymianHttpTransaction): boolean {
    return (
      isValidSuccessfulStatusCode(transaction.thymianRes.statusCode) ||
      isValidClientErrorStatusCode(transaction.thymianRes.statusCode)
    );
  }

  private async runTransaction(
    transaction: ThymianHttpTransaction,
    context: ReturnType<typeof createContext>,
    targetUrl?: string,
  ) {
    const transactionName = thymianHttpTransactionToString(
      transaction.thymianReq,
      transaction.thymianRes,
    );

    const reqFilter: RequestFilterFn = (_req, reqId) =>
      reqId === transaction.thymianReqId;
    const resFilter: ResponseFilterFn = (_res, resId) =>
      resId === transaction.thymianResId;

    const test = httpTest(transactionName, (transactions) =>
      transactions.pipe(
        filterHttpTransactions(reqFilter, resFilter),
        mapToTestCase(),
        generateRequests(),
        runRequests({ checkResponse: false, origin: targetUrl }),
      ),
    );

    return test(context);
  }

  private logFailureDetails(testCase?: HttpTestCase): void {
    if (!testCase) {
      this.log(oclif.ux.colorize('dim', '    Reason: No test result.'));
      return;
    }

    if (testCase.reason) {
      this.log(oclif.ux.colorize('dim', `    Reason: ${testCase.reason}`));
    }

    for (const result of testCase.results) {
      if (
        result.type === 'assertion-failure' ||
        result.type === 'invalid-transaction'
      ) {
        this.log(oclif.ux.colorize('dim', `    ${result.message}`));
      }
    }
  }
}
