import {
  addTransaction,
  createGetRequest,
  createHttpRequest,
  createHttpResponse,
  createOkResponse,
  createPostRequest,
  createThymianFormat,
} from '@thymian/core-testing';
import { createRuleTester, recorded } from '@thymian/rules-testing';
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

describe(rule.meta.name, () => {
  const ruleTester = createRuleTester(rule);

  // GET and HEAD that write out a 501, a GET that documents a 200, a GET whose
  // 501 only `5XX` implies, an explicit 501 beside a `5XX` range, and a POST
  // that writes out a 501. The OpenAPI plugin lets an explicit code win over
  // a range, so the range contributes only the codes not written out (500).
  function describedApi() {
    const format = createThymianFormat();
    const get501 = addTransaction(
      format,
      createGetRequest({ path: '/rockets' }),
      createHttpResponse({ statusCode: 501 }),
    );
    const head501 = addTransaction(
      format,
      createHttpRequest({ method: 'HEAD', path: '/rockets' }),
      createHttpResponse({ statusCode: 501 }),
    );
    const get200 = addTransaction(
      format,
      createGetRequest({ path: '/astronauts' }),
      createOkResponse(),
    );
    const rangeDerived501 = addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createHttpResponse({ statusCode: 501, derivedFromRange: '5XX' }),
    );
    const besideRange501 = addTransaction(
      format,
      createGetRequest({ path: '/missions' }),
      createHttpResponse({ statusCode: 501 }),
    );
    const besideRange500 = addTransaction(
      format,
      createGetRequest({ path: '/missions' }),
      createHttpResponse({ statusCode: 500, derivedFromRange: '5XX' }),
    );
    const post501 = addTransaction(
      format,
      createPostRequest({ path: '/rockets' }),
      createHttpResponse({ statusCode: 501 }),
    );

    return {
      format,
      get501,
      head501,
      get200,
      rangeDerived501,
      besideRange501,
      besideRange500,
      post501,
    };
  }

  it('flags, in lint, an explicit GET or HEAD 501 and nothing a range implies', async () => {
    const api = describedApi();

    const executions = await ruleTester.runLint(api.format);

    expect(executions).toMatchObject([
      {
        location: { elementId: api.get501 },
        status: 'failed',
        severity: 'error',
      },
      {
        location: { elementId: api.head501 },
        status: 'failed',
        severity: 'error',
      },
      { location: { elementId: api.get200 }, status: 'passed' },
      { location: { elementId: api.rangeDerived501 }, status: 'notApplicable' },
      { location: { elementId: api.besideRange501 }, status: 'failed' },
      { location: { elementId: api.besideRange500 }, status: 'notApplicable' },
      { location: { elementId: api.post501 }, status: 'notApplicable' },
    ]);
    expect(executions).toHaveLength(7);
  });

  it('reports, in analyze, a recorded 501 to GET even where only 5XX documents it', async () => {
    const { format, rangeDerived501 } = describedApi();

    const executions = await ruleTester.runAnalyze(format, {
      traffic: [recorded(format, rangeDerived501)],
    });

    expect(executions).toContainEqual(
      expect.objectContaining({
        location: expect.objectContaining({ elementId: rangeDerived501 }),
        status: 'failed',
      }),
    );
  });

  // The test override is unchanged: it probes every GET and HEAD, whatever
  // the description documents, and judges the live status.
  it('probes, in test, every GET and HEAD and fails a live 501', async () => {
    const api = describedApi();
    const asked: string[] = [];

    const executions = await ruleTester.runTest(api.format, {
      respond: ({ transaction, conforming }) => {
        asked.push(transaction);
        return conforming;
      },
    });

    expect(asked).not.toContain(api.post501);
    expect(executions).toContainEqual(
      expect.objectContaining({
        location: expect.objectContaining({ elementId: api.rangeDerived501 }),
        status: 'failed',
      }),
    );
    expect(executions).toContainEqual(
      expect.objectContaining({
        location: expect.objectContaining({ elementId: api.get200 }),
        status: 'passed',
      }),
    );
  });
});
