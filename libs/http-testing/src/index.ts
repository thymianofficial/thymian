import type {
  HttpTestCase,
  HttpTestCaseStep,
  HttpTestCaseTransaction,
  ThymianHttpTestTransaction,
} from './rxjs/http-test-case.js';

export * from './rxjs/request-generator/request-generator.js';
export * from './rxjs/http-request-template.js';
export * from './rxjs/http-response.js';
export * from './rxjs/http-test.js';
export * from './rxjs/http-test-case.js';
export * from './rxjs/operators/are-authorized.operator.js';
export * from './rxjs/operators/assert.js';
export * from './rxjs/operators/for-http-transactions.operator.js';
export * from './rxjs/operators/operators.js';
export * from './rxjs/operators/override-with-previous.operator.js';
export * from './rxjs/operators/replay-previous-step.operator.js';
export * from './rxjs/operators/step.operator.js';
export * from './rxjs/operators/to-test-cases.operator.js';
export * from './rxjs/operators/fail.operator.js';
export * from './rxjs/operators/assert.js';
export * from './rxjs/operators/authorize-requests.operator.js';
export * from './rxjs/operators/run-requests.operator.js';
export * from './rxjs/operators/generate-requests.operator.js';
export * from 'rxjs';

export function getPreviousSource<TestCase extends HttpTestCase>(
  testCase: TestCase
): TestCase extends HttpTestCase<infer Steps>
  ? Steps extends [...HttpTestCaseStep[], infer Prev, HttpTestCaseStep]
    ? Prev extends HttpTestCaseStep
      ? Prev['source']
      : undefined
    : undefined
  : undefined {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return testCase.steps.at(-2)?.source;
}

export function getPreviousTransactions<Steps extends HttpTestCaseStep[]>(
  testCase: HttpTestCase<Steps>
): HttpTestCaseTransaction[] {
  const c = testCase.steps.at(-2);

  if (typeof c === 'undefined') {
    throw new Error();
  }

  return c.transactions;
}

export function addToCurrentStep<Steps extends HttpTestCaseStep[]>(
  testCase: HttpTestCase<Steps>,
  transaction: HttpTestCaseTransaction
): HttpTestCase<Steps> {
  const curr = testCase.steps.at(-1);

  if (typeof curr === 'undefined') {
    throw new Error();
  } else {
    curr.transactions.push(transaction);
  }

  return testCase;
}

export function urlFromTestTransaction(
  transaction: ThymianHttpTestTransaction
): string {
  return `${transaction.thymianReq.protocol}://${transaction.thymianReq.host}:${transaction.thymianReq.port}${transaction.thymianReq.path}`;
}
