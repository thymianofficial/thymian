import {
  type Logger,
  thymianHttpTransactionToString,
  type ThymianReport,
} from '@thymian/core';
import { successfulStatusCode } from '@thymian/http-filter';
import {
  httpTest,
  type HttpTestContext,
  isSingleHttpTestCaseStep,
  singleTestCase,
} from '@thymian/http-testing';

export async function validate(
  context: HttpTestContext,
  logger: Logger,
  report: (report: ThymianReport) => void,
): Promise<boolean> {
  const test = httpTest(
    'Transactions with 2xx status code',
    singleTestCase()
      .forTransactionsWith(successfulStatusCode())
      .run({ checkResponse: true })
      .done(),
  );

  const results = await test(context);

  logger.debug(`Validated Thymian format in ${results.duration}ms.`);

  for (const testCase of results.cases) {
    if (testCase.status === 'skipped') {
      logger.debug(
        `HTTP test case "${testCase.name}" from test "@thymian/format-validator" is skipped.`,
      );

      report({
        producer: '@thymian/format-validator',
        severity: 'warn',
        summary: testCase.name,
        details:
          testCase.reason ??
          testCase.results
            .filter(
              (tc) => tc.type !== 'info' && tc.type !== 'assertion-success',
            )
            .map((tc) => tc.message)
            .join('\n'),
        category: 'Skipped HTTP Test Cases',
        timestamp: new Date().toISOString(),
      });
      continue;
    }

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
      source.thymianRes,
    );

    const category = '2xx responses';
    const producer = '@thymian/format-validator';

    testCase.results.forEach((result) => {
      if (result.type === 'assertion-failure') {
        report({
          producer,
          severity: 'error',
          summary: title,
          details: `\u274C ${result.message}`,
          category,
          timestamp: new Date().toISOString(),
        });
      } else if (result.type === 'assertion-success') {
        report({
          producer,
          severity: 'info',
          summary: title,
          details: `\u2705 ${result.message}`,
          category,
          timestamp: new Date().toISOString(),
        });
      } else if (result.type === 'info') {
        report({
          producer,
          severity: 'info',
          summary: title,
          details: `\u2796 ${result.message}`,
          category,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  return results.cases.every((testCase) => testCase.status === 'passed');
}
