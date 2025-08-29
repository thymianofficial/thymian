import {
  type Logger,
  thymianHttpTransactionToString,
  type ThymianReport,
} from '@thymian/core';
import { constant, statusCodeRange } from '@thymian/http-filter';
import { isValidSuccessfulStatusCode } from '@thymian/http-status-codes';
import {
  filter,
  generateRequests,
  httpTest,
  type HttpTestContext,
  isSingleHttpTestCaseStep,
  mapToTestCase,
  runRequests,
  singleTestCase,
  validateResponses,
} from '@thymian/http-testing';

export async function validate(
  context: HttpTestContext,
  logger: Logger,
  report: (report: ThymianReport) => void
): Promise<boolean> {
  const r = httpTest(
    'test',
    singleTestCase().forTransactionsWith(statusCodeRange(200, 299)).run().done()
  );

  const test = httpTest('@thymian/format-validate', (transactions) =>
    transactions.pipe(
      filter(({ current }) =>
        isValidSuccessfulStatusCode(current.thymianRes.statusCode)
      ),
      mapToTestCase(),
      generateRequests(),
      runRequests(),
      validateResponses()
    )
  );

  const results = await test(context);

  logger.debug(`Validated Thymian format in ${results.duration}ms.`);

  for (const testCase of results.cases) {
    const step = testCase.steps[0];

    if (
      !step ||
      testCase.steps.length !== 1 ||
      !isSingleHttpTestCaseStep(step)
    ) {
      throw new Error('Testcase should have exactly one step.');
    }

    const { transactions, source } = step;

    const transaction = transactions[0];

    if (!transaction || transactions.length !== 1) {
      throw new Error('Step should have exactly one transaction.');
    }

    const title = thymianHttpTransactionToString(
      source.thymianReq,
      source.thymianRes
    );

    testCase.results.forEach((result) => {
      if (result.type === 'assertion-failure') {
        report({
          text: `\u274C ${result.message}`,
          title,
          topic: '@thymian/format-validator',
          subTopic: 'Successful Responses',
          isProblem: true,
        });
      } else if (result.type === 'assertion-success') {
        report({
          text: `\u2705 ${result.message}`,
          title,
          topic: '@thymian/format-validator',
          subTopic: 'Successful Responses',
          isProblem: false,
        });
      } else if (result.type === 'info') {
        report({
          text: `\u2796 ${result.message}`,
          title,
          topic: '@thymian/format-validator',
          subTopic: 'Successful Responses',
          isProblem: false,
        });
      }
    });
  }

  return results.cases.every((testCase) => testCase.status === 'passed');
}
