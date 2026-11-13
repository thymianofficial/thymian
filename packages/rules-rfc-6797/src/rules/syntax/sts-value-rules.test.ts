import type { Parameter } from '@thymian/core';
import {
  addTransaction,
  createGetRequest,
  createOkResponse,
  createRequiredParameter,
  createStringSchema,
  createThymianFormat,
} from '@thymian/core-testing';
import { recorded, runRule } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import { STS_HEADER } from '../utils/sts-field-value.js';
import mayAssertIncludeSubdomains from './hsts-host-may-assert-include-subdomains.rule.js';
import mustNotRepeatDirectives from './hsts-host-must-not-repeat-sts-directives.rule.js';
import mustSendIncludeSubdomainsWithoutValue from './hsts-host-must-send-include-subdomains-without-value.rule.js';
import mustSendMaxAgeAsDeltaSeconds from './hsts-host-must-send-max-age-as-delta-seconds.rule.js';
import mustSendMaxAgeDirective from './hsts-host-must-send-max-age-directive.rule.js';
import mustConformToGrammar from './hsts-host-must-send-sts-header-conforming-to-grammar.rule.js';
import mustIgnoreUnrecognizedDirectives from './user-agent-must-ignore-unrecognized-sts-directives.rule.js';

// Every rule here holds each Strict-Transport-Security value to one
// requirement, so one shape tests them all: a value the rule flags and one it
// accepts, in every context the rule declares.
const valueRules = [
  {
    rule: mustConformToGrammar,
    violates: 'max-age=31536000, includeSubDomains',
    conforms: 'max-age=31536000; includeSubDomains',
    severity: 'error',
    message: 'does not conform to the RFC 6797 §6.1 grammar',
  },
  {
    rule: mustSendMaxAgeDirective,
    violates: 'includeSubDomains',
    conforms: 'max-age=31536000',
    severity: 'error',
    message: 'has no max-age directive',
  },
  {
    rule: mustSendMaxAgeAsDeltaSeconds,
    violates: 'max-age=1y',
    // Quoted is fine: the syntax applies after quoted-string unescaping.
    conforms: 'max-age="31536000"',
    severity: 'error',
    message: 'max-age="1y" is not a whole number of seconds',
  },
  {
    rule: mustSendIncludeSubdomainsWithoutValue,
    violates: 'max-age=31536000; includeSubDomains=true',
    conforms: 'max-age=31536000; includeSubDomains',
    severity: 'error',
    message: 'gives includeSubDomains a value',
  },
  {
    rule: mustNotRepeatDirectives,
    // Directive names are case-insensitive (§6.1 item 3).
    violates: 'max-age=31536000; Max-Age=60',
    conforms: 'max-age=31536000; includeSubDomains',
    severity: 'error',
    message: 'repeats the directive(s) "max-age"',
  },
  {
    rule: mayAssertIncludeSubdomains,
    violates: 'max-age=31536000',
    conforms: 'max-age=31536000; includeSubDomains',
    severity: 'hint',
    message: 'does not assert includeSubDomains',
  },
  {
    rule: mustIgnoreUnrecognizedDirectives,
    // A misspelling is flagged; `preload`, sent on purpose, is not.
    violates: 'max-age=31536000; includeSubDomain',
    conforms: 'max-age=31536000; includeSubDomains; preload',
    severity: 'hint',
    message: 'carries "includesubdomain", which RFC 6797 does not define',
  },
] as const;

// A declared Strict-Transport-Security header. A value pins it as the
// schema's `const`; without one the header is declared but unpinned.
function stsHeader(value?: string): Record<string, Parameter> {
  return {
    [STS_HEADER]: createRequiredParameter({
      schema: createStringSchema(value === undefined ? {} : { const: value }),
    }),
  };
}

describe.each(valueRules)(
  '$rule.meta.name',
  ({ rule, violates, conforms, severity, message }) => {
    const run = runRule(rule);

    it('judges, in static, the value the API description pins', async () => {
      const format = createThymianFormat();
      const flawed = addTransaction(
        format,
        createGetRequest({ path: '/launches' }),
        createOkResponse({ headers: stsHeader(violates) }),
      );
      const sound = addTransaction(
        format,
        createGetRequest({ path: '/astronauts' }),
        createOkResponse({ headers: stsHeader(conforms) }),
      );
      // Declared without a value: nothing to judge, which is a skip and not
      // a pass.
      const unpinned = addTransaction(
        format,
        createGetRequest({ path: '/probes' }),
        createOkResponse({ headers: stsHeader() }),
      );
      const withoutHeader = addTransaction(
        format,
        createGetRequest({ path: '/rockets' }),
        createOkResponse(),
      );

      expect(await run.static(format)).toMatchObject([
        {
          location: { elementId: flawed },
          status: 'failed',
          severity,
          message: expect.stringContaining(message),
        },
        { location: { elementId: sound }, status: 'passed' },
        {
          location: { elementId: unpinned },
          status: 'skipped',
          reason: expect.stringContaining('without pinning its value'),
        },
        { location: { elementId: withoutHeader }, status: 'notApplicable' },
      ]);
    });

    // The API description declares no header at all: a server sending one
    // anyway is what a rule that only looked at declared headers would miss.
    it('judges, in test, the value the server sends although none is declared', async () => {
      const format = createThymianFormat();
      const flawed = addTransaction(
        format,
        createGetRequest({ path: '/launches' }),
        createOkResponse(),
      );
      const sound = addTransaction(
        format,
        createGetRequest({ path: '/astronauts' }),
        createOkResponse(),
      );
      const withoutHeader = addTransaction(
        format,
        createGetRequest({ path: '/rockets' }),
        createOkResponse(),
      );
      const sent: Record<string, string> = {
        [flawed]: violates,
        [sound]: conforms,
      };

      const executions = await run.test(format, {
        respond: ({ transaction, conforming }) => {
          const value = sent[transaction];
          return value === undefined
            ? conforming
            : {
                ...conforming,
                headers: { ...conforming.headers, [STS_HEADER]: value },
              };
        },
      });

      expect(executions).toMatchObject([
        {
          location: { elementId: flawed },
          status: 'failed',
          severity,
          message: expect.stringContaining(message),
        },
        { location: { elementId: sound }, status: 'passed' },
        { location: { elementId: withoutHeader }, status: 'passed' },
      ]);
    });

    it('judges, in analytics, the value that was recorded', async () => {
      const format = createThymianFormat();
      const flawed = addTransaction(
        format,
        createGetRequest({ path: '/launches' }),
        createOkResponse(),
      );
      const sound = addTransaction(
        format,
        createGetRequest({ path: '/astronauts' }),
        createOkResponse(),
      );
      const withoutHeader = addTransaction(
        format,
        createGetRequest({ path: '/rockets' }),
        createOkResponse(),
      );

      const executions = await run.analytics(format, {
        traffic: [
          recorded(format, flawed, {
            response: { headers: { [STS_HEADER]: violates } },
          }),
          recorded(format, sound, {
            response: { headers: { [STS_HEADER]: conforms } },
          }),
          recorded(format, withoutHeader),
        ],
      });

      expect(executions).toMatchObject([
        {
          location: { elementId: flawed },
          status: 'failed',
          severity,
          message: expect.stringContaining(message),
        },
        { location: { elementId: sound }, status: 'passed' },
        { location: { elementId: withoutHeader }, status: 'passed' },
      ]);
    });
  },
);
