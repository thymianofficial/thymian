import { type Logger, type ThymianReport } from '@thymian/core';
import { successfulStatusCode } from '@thymian/core';
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

  logger.debug('Validating Thymian format.');
  const results = await test(context);

  logger.debug(`Validated Thymian format in ${results.duration}ms.`);

  const producer = '@thymian/format-validator';

  const numbers = results.cases.reduce(
    (acc, c) => {
      acc[c.status]++;
      return acc;
    },
    {
      passed: 0,
      failed: 0,
      skipped: 0,
      running: 0,
    },
  );

  report({
    producer,
    severity: 'info',
    summary: `${numbers.passed} passed ✅  ${numbers.failed} failed ❌  ${numbers.skipped} skipped ⏭️`,
    timestamp: Date.now(),
    title: `Validated ${results.cases.length} HTTP transactions in ${results.duration.toPrecision(4)}ms.`,
  });

  for (const testCase of results.cases) {
    if (testCase.status === 'skipped') {
      logger.debug(
        `HTTP test case "${testCase.name}" from test "@thymian/format-validator" is skipped.`,
      );

      report({
        producer,
        severity: 'info',
        summary: testCase.reason ?? 'Because of an unknown reason.',
        details:
          testCase.reason ??
          testCase.results
            .filter(
              (tc) => tc.type !== 'info' && tc.type !== 'assertion-success',
            )
            .map((tc) => tc.message)
            .join('\n'),
        category: 'Skipped HTTP Test Cases',
        timestamp: Date.now(),
        title: testCase.name,
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

    const { transactions } = step;

    const transaction = transactions[0];

    if (!transaction || transactions.length !== 1) {
      throw new Error('Step should have exactly one transaction.');
    }

    const category = '2xx responses';

    testCase.results.forEach((result) => {
      if (result.type === 'assertion-failure') {
        report({
          producer,
          severity: 'error',
          summary: `\u274C ${result.message}`,
          category,
          timestamp: Date.now(),
          title: testCase.name,
        });
      } else if (result.type === 'assertion-success') {
        report({
          producer,
          severity: 'info',
          summary: `\u2705 ${result.message}`,
          category,
          timestamp: Date.now(),
          title: testCase.name,
        });
      } else if (result.type === 'info') {
        report({
          producer,
          severity: 'info',
          summary: `\u2796 ${result.message}`,
          category,
          timestamp: Date.now(),
          title: testCase.name,
        });
      }
    });
  }

  return results.cases.every((testCase) => testCase.status === 'passed');
}
