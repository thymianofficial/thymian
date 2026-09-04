import { BaseCliRunCommand, oclif } from '@thymian/common-cli';
import { Flags } from '@thymian/common-cli/oclif';
import {
  filterHttpTransactions,
  generateRequests,
  httpTest,
  isValidClientErrorStatusCode,
  isValidSuccessfulStatusCode,
  mapToTestCase,
  type RequestFilterFn,
  type ResponseFilterFn,
  runRequests,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';

import { selectorForTransaction } from '../../../selectors/selector.js';
import {
  checkedFromError,
  checkedFromTestCase,
  type CheckedTransaction,
  type Outcome,
  summaryOf,
} from '../../check-result.js';
import { createContext } from '../../create-context.js';

/** One glyph per Outcome, so four states read as four states. */
const MARKS: Record<
  Outcome,
  { mark: string; color: 'green' | 'red' | 'yellow' }
> = {
  passed: { mark: '✔', color: 'green' },
  failed: { mark: '✖', color: 'red' },
  skipped: { mark: '↷', color: 'yellow' },
  errored: { mark: '!', color: 'red' },
};

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
        'After each transaction that is not passed, print how to shape it with a hook.',
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

      const targetUrl =
        this.flags['target-url'] ?? this.thymianConfig.targetUrl;

      const context = createContext(
        format,
        this.logger.child('sampler-check'),
        emitter,
      );

      const checked: CheckedTransaction[] = [];

      for (const transaction of format.getThymianHttpTransactions()) {
        if (!this.isCheckableTransaction(transaction)) {
          continue;
        }

        const result = await this.checkTransaction(
          transaction,
          context,
          targetUrl,
        );

        checked.push(result);
        this.report(result);
      }

      this.summarize(checked);
    });
  }

  /**
   * Run one Transaction and say what it earned.
   *
   * The `try` is the whole point of the outcome model. A hook defect, a request
   * that cannot be serialized or a refused connection used to reject the
   * pipeline's observable and abort the command, so one broken transaction hid
   * every transaction after it. Here it ends that transaction and nothing else.
   */
  private async checkTransaction(
    transaction: ThymianHttpTransaction,
    context: ReturnType<typeof createContext>,
    targetUrl?: string,
  ): Promise<CheckedTransaction> {
    this.logger.debug(
      'Checking transaction: ' + selectorForTransaction(transaction),
    );

    try {
      const testResult = await this.runTransaction(
        transaction,
        context,
        targetUrl,
      );

      const testCase = testResult.cases[0];

      return testCase
        ? checkedFromTestCase(testCase, transaction)
        : checkedFromError(
            new Error(
              'The test pipeline produced no result for this transaction.',
            ),
            transaction,
          );
    } catch (e) {
      return checkedFromError(e, transaction);
    }
  }

  /** One line per transaction, then its reason once, then its remediation. */
  private report(result: CheckedTransaction): void {
    const { mark, color } = MARKS[result.outcome];

    this.log(oclif.ux.colorize(color, `${mark} ${result.selector}`));

    if (result.outcome === 'passed') {
      return;
    }

    for (const line of [result.reason, ...result.details].filter(Boolean)) {
      this.log(oclif.ux.colorize('dim', `    ${line}`));
    }

    if (this.flags.incremental) {
      this.log(
        oclif.ux.colorize(
          'dim',
          '    Shape this request by anchoring a hook to its selector, printed above.',
        ),
      );
    }

    this.log();
  }

  /**
   * The tally, and the exit code.
   *
   * `process.exitCode` rather than `this.exit()`: an early exit throws past the
   * run's teardown, and teardown is where the user's `afterAll` cleanups live.
   * The command finishes, and then the shell learns how it went.
   */
  private summarize(checked: readonly CheckedTransaction[]): void {
    const summary = summaryOf(checked);

    this.log();

    if (summary.passed === summary.total) {
      this.log(
        oclif.ux.colorize(
          'green',
          `Checked ${summary.total} transactions. All passed.`,
        ),
      );

      return;
    }

    const tally = (['failed', 'skipped', 'errored'] as const)
      .filter((outcome) => summary[outcome] > 0)
      .map((outcome) => `${summary[outcome]} ${outcome}`);

    this.log(
      `Checked ${summary.total} transactions: ${summary.passed} passed, ${tally.join(', ')}.`,
    );

    process.exitCode = 1;
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
    const reqFilter: RequestFilterFn = (_req, reqId) =>
      reqId === transaction.thymianReqId;
    const resFilter: ResponseFilterFn = (_res, resId) =>
      resId === transaction.thymianResId;

    const test = httpTest(
      thymianHttpTransactionToString(
        transaction.thymianReq,
        transaction.thymianRes,
      ),
      (transactions) =>
        transactions.pipe(
          filterHttpTransactions(reqFilter, resFilter),
          mapToTestCase(),
          generateRequests(),
          runRequests({ checkResponse: false, origin: targetUrl }),
        ),
    );

    return test(context);
  }
}
