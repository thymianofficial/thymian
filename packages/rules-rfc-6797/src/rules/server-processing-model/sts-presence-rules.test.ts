import {
  addTransaction,
  createGetRequest,
  createOkResponse,
  createRequiredParameter,
  createThymianFormat,
} from '@thymian/core-testing';
import { runRule } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import { STS_HEADER } from '../utils/sts-field-value.js';
import mayEstablishHsts from './server-may-establish-hsts-over-secure-transport.rule.js';
import shouldSendStsHeader from './server-should-send-sts-header-over-secure-transport.rule.js';

// The RFC's MAY and the convention that asks the header of every server
// report the same wire fact, a response over https without the header, at
// their own severity: the hint ships on, the convention ships `off`.
const presenceRules = [
  {
    rule: mayEstablishHsts,
    severity: 'hint',
    message:
      'This response over secure transport (https) carries no Strict-Transport-Security header field. RFC 6797 lets a host establish HSTS by returning one; this response does not use it.',
  },
  {
    rule: shouldSendStsHeader,
    severity: 'off',
    message:
      'This response over secure transport (https) carries no Strict-Transport-Security header field, so it gives the browser no HSTS Policy to note or refresh.',
  },
] as const;

const stsHeader = { [STS_HEADER]: createRequiredParameter() };

describe.each(presenceRules)(
  '$rule.meta.name',
  ({ rule, severity, message }) => {
    const run = runRule(rule);

    // Presence is a name, which every context sees the same way: declared
    // in `static`, sent in `test`, recorded in `analytics`.
    it.each(['static', 'test', 'analytics'] as const)(
      'flags, in %s, the response over https without the header',
      async (context) => {
        const format = createThymianFormat();
        const withoutHeader = addTransaction(
          format,
          createGetRequest({ path: '/launches' }),
          createOkResponse(),
        );
        const withHeader = addTransaction(
          format,
          createGetRequest({ path: '/astronauts' }),
          createOkResponse({ headers: stsHeader }),
        );
        // Only a response over secure transport is asked for the header.
        const overHttp = addTransaction(
          format,
          createGetRequest({ protocol: 'http', port: 80, path: '/rockets' }),
          createOkResponse(),
        );

        expect(await run[context](format)).toMatchObject([
          {
            location: { elementId: withoutHeader },
            status: 'failed',
            severity,
            message,
          },
          { location: { elementId: withHeader }, status: 'passed' },
          { location: { elementId: overHttp }, status: 'notApplicable' },
        ]);
      },
    );

    it('accepts, in test, a header the server sends although none is declared', async () => {
      const format = createThymianFormat();
      const headerSent = addTransaction(
        format,
        createGetRequest({ path: '/launches' }),
        createOkResponse(),
      );
      const headerNotSent = addTransaction(
        format,
        createGetRequest({ path: '/astronauts' }),
        createOkResponse(),
      );

      const executions = await run.test(format, {
        respond: ({ transaction, conforming }) =>
          transaction === headerSent
            ? {
                ...conforming,
                headers: {
                  ...conforming.headers,
                  [STS_HEADER]: 'max-age=31536000',
                },
              }
            : conforming,
      });

      expect(executions).toMatchObject([
        { location: { elementId: headerSent }, status: 'passed' },
        { location: { elementId: headerNotSent }, status: 'failed', message },
      ]);
    });
  },
);
