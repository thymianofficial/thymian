import type {
  CustomHttpTestCaseStep,
  GroupedHttpTestCaseStep,
  HttpTestCase,
  HttpTestCaseStep,
  SingleHttpTestCaseStep,
} from './http-test-case.js';

export function isSingleHttpTestCaseStep(
  step?: HttpTestCaseStep
): step is SingleHttpTestCaseStep {
  return step?.type === 'single';
}

export function isGroupedHttpTestCaseStep(
  step?: HttpTestCaseStep
): step is GroupedHttpTestCaseStep {
  return step?.type === 'grouped';
}

export function isCustomHttpTestCaseStep(
  step?: HttpTestCaseStep
): step is CustomHttpTestCaseStep {
  return step?.type === 'custom';
}

export function isSkippedTestCase<Steps extends HttpTestCaseStep[]>(
  testCase: HttpTestCase<Steps>
): testCase is HttpTestCase<Steps> & { status: 'skipped' } {
  return testCase.status === 'skipped';
}

export function isFailedTestCase<Steps extends HttpTestCaseStep[]>(
  testCase: HttpTestCase<Steps>
): testCase is HttpTestCase<Steps> & { status: 'failed' } {
  return testCase.status === 'failed';
}
