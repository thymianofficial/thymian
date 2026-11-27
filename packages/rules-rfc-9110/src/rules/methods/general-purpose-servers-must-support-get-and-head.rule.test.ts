import {
  addTransaction,
  createGetRequest,
  createHttpRequest,
  createHttpResponse,
  createOkResponse,
  createPostRequest,
  createThymianFormat,
} from '@thymian/core-testing';
import { createRuleTester } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import { runTestRuleCases } from '../../../test/run-test-rule.js';
import rule from './general-purpose-servers-must-support-get-and-head.rule.js';

// The specification declares only a 200: it never documents the 501 the rule
// forbids.
const described = {
  req: createHttpRequest({ method: 'get', path: '/rockets' }),
  res: createHttpResponse({ statusCode: 200 }),
};

function live(statusCode: number) {
  return { statusCode, headers: {}, trailers: {}, duration: 0 };
}

describe('rfc9110/general-purpose-servers-must-support-get-and-head (test)', () => {
  it('fails a live 501 to GET that the description does not declare', async () => {
    const { cases } = await runTestRuleCases(rule, described, live(501));

    expect(cases.map((c) => c.status)).toEqual(['failed']);
  });

  it('passes a live 200 to GET', async () => {
    const { cases } = await runTestRuleCases(rule, described, live(200));

    expect(cases.map((c) => c.status)).toEqual(['passed']);
  });
});

describe('rfc9110/general-purpose-servers-must-support-get-and-head (static)', () => {
  const ruleTester = createRuleTester(rule);

  it('flags a GET or HEAD that documents a 501', async () => {
    const format = createThymianFormat();
    const get = addTransaction(
      format,
      createGetRequest({ path: '/rockets' }),
      createHttpResponse({ statusCode: 501 }),
    );
    const head = addTransaction(
      format,
      createHttpRequest({ method: 'HEAD', path: '/rockets' }),
      createHttpResponse({ statusCode: 501 }),
    );

    const executions = await ruleTester.runLint(format);

    expect(executions).toMatchObject([
      { location: { elementId: get }, status: 'failed', severity: 'error' },
      { location: { elementId: head }, status: 'failed', severity: 'error' },
    ]);
  });

  it('passes a GET that documents a 200', async () => {
    const format = createThymianFormat();
    const ok = addTransaction(
      format,
      createGetRequest({ path: '/rockets' }),
      createOkResponse(),
    );

    const executions = await ruleTester.runLint(format);

    expect(executions).toMatchObject([
      { location: { elementId: ok }, status: 'passed' },
    ]);
  });

  it('does not flag a GET whose 501 only a 5XX range implies', async () => {
    const format = createThymianFormat();
    const rangeDerived = addTransaction(
      format,
      createGetRequest({ path: '/rockets' }),
      createHttpResponse({ statusCode: 501, derivedFromRange: '5XX' }),
    );

    const executions = await ruleTester.runLint(format);

    expect(executions).toMatchObject([
      { location: { elementId: rangeDerived }, status: 'notApplicable' },
    ]);
  });

  it('flags an explicit 501 that sits beside a 5XX range', async () => {
    // The OpenAPI plugin lets an explicit code win over the range, so the
    // range contributes only the codes not written out.
    const format = createThymianFormat();
    const explicit = addTransaction(
      format,
      createGetRequest({ path: '/rockets' }),
      createHttpResponse({ statusCode: 501 }),
    );
    const rangeDerived = addTransaction(
      format,
      createGetRequest({ path: '/rockets' }),
      createHttpResponse({ statusCode: 500, derivedFromRange: '5XX' }),
    );

    const executions = await ruleTester.runLint(format);

    expect(executions).toMatchObject([
      { location: { elementId: explicit }, status: 'failed' },
      { location: { elementId: rangeDerived }, status: 'notApplicable' },
    ]);
  });

  it('does not apply to a POST that documents a 501', async () => {
    const format = createThymianFormat();
    const post = addTransaction(
      format,
      createPostRequest({ path: '/rockets' }),
      createHttpResponse({ statusCode: 501 }),
    );

    const executions = await ruleTester.runLint(format);

    expect(executions).toMatchObject([
      { location: { elementId: post }, status: 'notApplicable' },
    ]);
  });
});
