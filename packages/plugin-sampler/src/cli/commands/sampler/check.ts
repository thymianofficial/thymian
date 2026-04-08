import { BaseCliRunCommand, oclif, prompts } from '@thymian/common-cli';
import { Flags } from '@thymian/common-cli/oclif';
import {
  getHeader,
  type HttpResponse,
  httpStatusCodeToPhrase,
  isValidClientErrorStatusCode,
  isValidHttpStatusCode,
  isValidSuccessfulStatusCode,
  serializeRequest,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';

type CheckResult =
  | { passed: true }
  | { passed: false; reason: string; response?: HttpResponse };

const MAX_BODY_PREVIEW_LENGTH = 500;

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
    await this.thymian.run(async () => {
      const specifications = this.thymianConfig.specifications ?? [];

      const format = await this.thymian.loadFormat({
        inputs: specifications,
      });

      const transactions = format.getThymianHttpTransactions();
      const targetUrl =
        this.flags['target-url'] ?? this.thymianConfig.targetUrl;

      if (this.flags.incremental) {
        await this.checkTransactionsIncremental(transactions, targetUrl);
      } else {
        await this.checkAllTransactions(transactions, targetUrl);
      }
    });
  }

  private async checkAllTransactions(
    transactions: ThymianHttpTransaction[],
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

      const result = await this.checkTransaction(transaction, targetUrl);

      if (result.passed) {
        this.log(oclif.ux.colorize('green', `✔ ${transactionName}`));
        successful++;
      } else {
        this.log(oclif.ux.colorize('red', `✖ ${transactionName}`));
        this.logFailureDetails(result);
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

      const result = await this.checkTransaction(transaction, targetUrl);

      if (result.passed) {
        this.log(oclif.ux.colorize('green', `✔ ${transactionName}`));
        continue;
      }

      this.log(oclif.ux.colorize('red', `✖ ${transactionName}`));
      this.logFailureDetails(result);

      this.log();
      this.log('You can generate a hook for this transaction with:');
      this.log(
        `  $ thymian sampler hooks generate --for-transaction ${transaction.transactionId}`,
      );
      this.log();

      if (!this.config.findCommand('sampler:hooks:generate')) {
        this.debug(
          'Command sampler:hooks:generate is not available. Skipping hook generation prompt.',
        );
        continue;
      }

      const answer = await prompts.confirm({
        message: 'Do you want to generate a hook to fix this transaction?',
        default: false,
      });

      if (answer) {
        await this.config.runCommand('sampler:hooks:generate', [
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

  private async checkTransaction(
    transaction: ThymianHttpTransaction,
    targetUrl?: string,
  ): Promise<CheckResult> {
    try {
      const template = await this.thymian.sample({ transaction });

      const request = serializeRequest({
        requestTemplate: template,
        source: transaction,
      });

      if (targetUrl) {
        request.origin = targetUrl;
      }

      const response = await this.thymian.dispatch({ request });

      if (response.statusCode !== transaction.thymianRes.statusCode) {
        return {
          passed: false,
          reason: `Expected status ${transaction.thymianRes.statusCode}, got ${response.statusCode}.`,
          response,
        };
      }

      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private logFailureDetails(
    result: Extract<CheckResult, { passed: false }>,
  ): void {
    this.log(oclif.ux.colorize('dim', `    Reason: ${result.reason}`));

    if (!result.response) {
      return;
    }

    const { statusCode, headers, body } = result.response;
    const phrase = isValidHttpStatusCode(statusCode)
      ? httpStatusCodeToPhrase[statusCode]
      : '';
    const contentType = getHeader(headers, 'content-type');
    const contentTypeStr = Array.isArray(contentType)
      ? contentType[0]
      : contentType;

    this.log(
      oclif.ux.colorize(
        'dim',
        `    Received: ${statusCode} ${phrase}${contentTypeStr ? ` (${contentTypeStr})` : ''}`,
      ),
    );

    if (body) {
      const preview =
        body.length > MAX_BODY_PREVIEW_LENGTH
          ? body.slice(0, MAX_BODY_PREVIEW_LENGTH) + '…'
          : body;

      this.log(oclif.ux.colorize('dim', `    Body: ${preview}`));
    }
  }
}
