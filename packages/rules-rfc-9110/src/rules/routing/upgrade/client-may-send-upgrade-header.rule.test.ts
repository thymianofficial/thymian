import {
  addTransaction,
  createGetRequest,
  createOkResponse,
  createOptionalParameter,
  createStringSchema,
  createThymianFormat,
} from '@thymian/core-testing';
import { createRuleTester, recorded } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './client-may-send-upgrade-header.rule.js';

const hint = { status: 'failed', severity: 'hint' };

describe(rule.meta.name, () => {
  const ruleTester = createRuleTester(rule);

  function describedApi() {
    const format = createThymianFormat();
    const invitesUpgrade = addTransaction(
      format,
      createGetRequest({
        path: '/launches/live',
        headers: {
          upgrade: createOptionalParameter({
            schema: createStringSchema({ examples: ['websocket'] }),
          }),
        },
      }),
      createOkResponse(),
    );
    const plain = addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
    );

    return { format, invitesUpgrade, plain };
  }

  it('hints, in static, at the request the description declares Upgrade on', async () => {
    const { format, invitesUpgrade, plain } = describedApi();

    expect(await ruleTester.runLint(format)).toMatchObject([
      { location: { elementId: invitesUpgrade }, ...hint },
      { location: { elementId: plain }, status: 'notApplicable' },
    ]);
  });

  it('hints, in analytics, at the recorded request that carries Upgrade', async () => {
    const { format, invitesUpgrade, plain } = describedApi();

    const executions = await ruleTester.runAnalyze(format, {
      traffic: [
        recorded(format, invitesUpgrade, {
          request: { headers: { upgrade: 'websocket' } },
        }),
        recorded(format, plain),
      ],
    });

    expect(executions).toMatchObject([
      { location: { elementId: invitesUpgrade }, ...hint },
      { location: { elementId: plain }, status: 'notApplicable' },
    ]);
  });
});
