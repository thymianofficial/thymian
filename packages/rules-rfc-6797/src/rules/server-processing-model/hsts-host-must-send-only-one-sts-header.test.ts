import {
  addTransaction,
  createGetRequest,
  createOkResponse,
  createThymianFormat,
} from '@thymian/core-testing';
import { recorded, runRule } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import { STS_HEADER } from '../utils/sts-field-value.js';
import rule from './hsts-host-must-send-only-one-sts-header.rule.js';

// Two field lines of one name arrive as an array, from the server in `test`
// and from the recorded traffic in `analytics`. Each line on its own is a
// valid policy: the defect is that there are two.
const twice = { [STS_HEADER]: ['max-age=31536000', 'max-age=0'] };
const once = { [STS_HEADER]: 'max-age=31536000' };

const failedForTwo = {
  status: 'failed',
  severity: 'error',
  message: expect.stringContaining(
    'carries 2 Strict-Transport-Security header fields ("max-age=31536000", "max-age=0")',
  ),
};

describe(rule.meta.name, () => {
  const run = runRule(rule);

  // An API description cannot declare two field lines of one header, so
  // what is judged is what the server sends beyond it.
  function describedApi() {
    const format = createThymianFormat();
    const sentTwice = addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
    );
    const sentOnce = addTransaction(
      format,
      createGetRequest({ path: '/astronauts' }),
      createOkResponse(),
    );
    const notSent = addTransaction(
      format,
      createGetRequest({ path: '/rockets' }),
      createOkResponse(),
    );

    return { format, sentTwice, sentOnce, notSent };
  }

  it('flags, in test, the response the server sends the header twice in', async () => {
    const { format, sentTwice, sentOnce, notSent } = describedApi();
    const sent: Record<string, typeof twice | typeof once> = {
      [sentTwice]: twice,
      [sentOnce]: once,
    };

    const executions = await run.test(format, {
      respond: ({ transaction, conforming }) => ({
        ...conforming,
        headers: { ...conforming.headers, ...sent[transaction] },
      }),
    });

    expect(executions).toMatchObject([
      { location: { elementId: sentTwice }, ...failedForTwo },
      { location: { elementId: sentOnce }, status: 'passed' },
      { location: { elementId: notSent }, status: 'passed' },
    ]);
  });

  it('flags, in analytics, the recorded response that carries the header twice', async () => {
    const { format, sentTwice, sentOnce, notSent } = describedApi();

    const executions = await run.analytics(format, {
      traffic: [
        recorded(format, sentTwice, { response: { headers: twice } }),
        recorded(format, sentOnce, { response: { headers: once } }),
        recorded(format, notSent),
      ],
    });

    expect(executions).toMatchObject([
      { location: { elementId: sentTwice }, ...failedForTwo },
      { location: { elementId: sentOnce }, status: 'passed' },
      { location: { elementId: notSent }, status: 'passed' },
    ]);
  });
});
