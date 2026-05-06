import { BaseCliRunCommand, oclif, prompts } from '@thymian/common-cli';
import { Flags, ux } from '@thymian/common-cli/oclif';
import {
  createContextFromEmitter,
  filterHttpTransactions,
  type HttpRequest,
  type HttpResponse,
  httpStatusCodeToPhrase,
  httpTest,
  isValidHttpStatusCode,
  mapToTestCase,
  runRequests,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';
import { rxjs } from '@thymian/core';

export default class RunRequest extends BaseCliRunCommand<typeof RunRequest> {
  static override flags = {
    validate: Flags.boolean({
      default: false,
    }),
    timeout: Flags.integer({
      default: 1000,
      charAliases: ['t'],
      description:
        'Set the duration in ms to wait until a plugin is registered.',
      helpGroup: 'BASE',
    }),
  };

  override async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      const specifications = this.thymianConfig.specifications ?? [];

      const format = await this.thymian.loadFormat({
        inputs: specifications,
        validateSpecs: this.flags['validate-specs'],
      });

      const titleToTransaction = new Map<string, ThymianHttpTransaction>();

      for (const t of format.getThymianHttpTransactions()) {
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
        message: 'For which transaction do you want to run a request?',
        source: (answersSoFar) => {
          if (typeof answersSoFar === 'undefined') {
            return transactions;
          }

          return transactions.filter((t) => {
            const splitAnswer = answersSoFar
              .split(/([\s/])/)
              .filter((s) => s.trim() !== '' && s !== '/')
              .map((s) => s.toLowerCase());

            return splitAnswer.every((a) => t.name.toLowerCase().includes(a));
          });
        },
      });

      const transaction = titleToTransaction.get(result);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      let template = await this.thymian.sample({
        transaction,
      });

      const modifySample = await prompts.confirm({
        message: 'Do you want to modify the sample?',
        default: false,
      });

      if (modifySample) {
        template = JSON.parse(
          await prompts.editor({
            message: 'Edit the sample',
            waitForUserInput: false,
            default: JSON.stringify(template, null, 2),
          }),
        );
      }

      const test = httpTest(result, (transactions) => {
        return transactions.pipe(
          filterHttpTransactions(
            (req, reqId) => reqId === transaction.thymianReqId,
            (res, resId) => resId === transaction.thymianResId,
          ),
          mapToTestCase(),
          rxjs.map((t) => {
            const step = t.current.steps[0];

            if (step) {
              step.transactions.push({
                requestTemplate: template,
                source: transaction,
              });
            }

            return t;
          }),
          runRequests({ checkResponse: true }),
        );
      });

      const context = createContextFromEmitter(format, this.logger, emitter);
      const testResults = await test(context);

      this.log();

      testResults.cases.forEach((testResult) => {
        if (testResult.status === 'failed') {
          this.log(
            oclif.ux.colorize(
              'red',
              `✖ ${testResult.name}: ${testResult.reason}`,
            ),
          );
        }
        if (testResult.status === 'skipped') {
          this.log(
            oclif.ux.colorize(
              'yellow',
              `⚠ ${testResult.name}: ${testResult.reason}`,
            ),
          );
        }
      });

      this.log();

      for (const testCase of testResults.cases) {
        for (const step of testCase.steps) {
          for (const { request, response } of step.transactions) {
            if (request) {
              this.printRawRequest(request);
            }
            if (response) {
              this.printRawHttp(response);
            }
          }
        }

        this.log();

        if (this.flags.validate) {
          const assertionFailure = testCase.results.filter(
            (r) => r.type === 'assertion-failure',
          );

          if (assertionFailure.length > 0) {
            this.log(ux.colorize('red', 'The following assertions failed:'));
            assertionFailure.forEach((r) => {
              this.log(ux.colorize('red', `  * ${r.message}`));
            });
          }
        }
      }
    });
  }

  private printRawHttp(response: HttpResponse) {
    const protocol = 'HTTP/1.1';
    const status = response.statusCode;
    const statusText = isValidHttpStatusCode(status)
      ? httpStatusCodeToPhrase[status].toUpperCase()
      : '';

    const statusColor =
      status >= 200 && status < 300
        ? ux.colorize('green', `${status} ${statusText}`)
        : ux.colorize('red', `${status} ${statusText}`);

    this.log(ux.colorize('bold', `${protocol} ${statusColor}`));

    Object.keys(response.headers).forEach((key) => {
      this.log(`${ux.colorize('cyan', key)}: ${response.headers[key]}`);
    });

    this.log();

    this.printBody(response.body);

    Object.keys(response.trailers).forEach((key) => {
      this.log(`${ux.colorize('cyan', key)}: ${response.headers[key]}`);
    });
  }

  private printRawRequest(request: HttpRequest): void {
    const urlObj = new URL(request.path, request.origin);

    const path = urlObj.pathname + urlObj.search;
    const method = ux.colorize('blue', request.method.toUpperCase());

    this.log(ux.colorize('bold', `${method} ${path} HTTP/1.1`));

    this.log(`${ux.colorize('cyan', 'Host')}: ${urlObj.host}`);
    Object.entries(request.headers ?? {}).forEach(([key, value]) => {
      if (!value) {
        return;
      }
      const headerValue = Array.isArray(value) ? value.join(', ') : value;
      this.log(`${ux.colorize('cyan', key)}: ${headerValue}`);
    });

    this.log();
    this.printBody(request.body);
    this.log();
  }

  private printBody(body: unknown): void {
    try {
      if (typeof body === 'undefined') {
        return;
      }

      if (typeof body === 'string') {
        this.log(
          ux.colorizeJson(body, {
            pretty: true,
            theme: {
              brace: '#00FFFF',
              bracket: 'rgb(0, 255, 255)',
              colon: 'dim',
              comma: 'yellow',
              key: 'bold',
              string: 'green',
              number: 'blue',
              boolean: 'cyan',
              null: 'redBright',
            },
          }),
        );
      }
    } catch (_) {
      console.log(body);
    }
  }
}
