import type {
  Logger,
  ThymianHttpRequest,
  ThymianHttpResponse,
  ThymianReport,
} from '@thymian/core';
import {
  httpStatusCodeToPhrase,
  isValidHttpStatusCode,
  isValidSuccessfulStatusCode,
} from '@thymian/http-status-codes';
import {
  httpTest,
  type HttpTestContext,
  isSingleHttpTestCaseStep,
} from '@thymian/http-testing';

export function transactionToTitle(
  req: ThymianHttpRequest,
  res: ThymianHttpResponse
): string {
  const statusCode = res.statusCode;
  const phrase = isValidHttpStatusCode(statusCode)
    ? httpStatusCodeToPhrase[statusCode]
    : 'Invalid status code';

  let title = `${req.method.toUpperCase()} ${req.path}`;

  if (req.mediaType) {
    title += ` - ${req.mediaType} `;
  }

  title += ` \u2192 ${res.statusCode} ${phrase.toUpperCase()}`;

  if (res.mediaType) {
    title += ` - ${res.mediaType}`;
  }

  return title;
}

export async function validate(
  context: HttpTestContext,
  logger: Logger,
  report: (report: ThymianReport) => void
): Promise<boolean> {
  const test = httpTest('@thymian/format-validate', {
    resFilter: (res) => isValidSuccessfulStatusCode(res.statusCode),
    validate: true,
    authorize: true,
  });

  const results = await test(context);

  logger.debug(`Validate Thymian format in ${results.duration}ms.`);

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

    const title = transactionToTitle(source.thymianReq, source.thymianRes);

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
        // U+2796
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
