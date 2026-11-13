import { httpRule, type RuleSeverity, statusCode } from '@thymian/core';
import {
  addTransaction,
  createCreatedResponse,
  createGetRequest,
  createOkResponse,
  createPostRequest,
  createRequiredParameter,
  createThymianFormat,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { runRule } from '../src/index.js';

describe('runRule(rule, { options })', () => {
  describe('a rule that ships with severity off', () => {
    const needsLocation = (severity: RuleSeverity) =>
      httpRule('test/created-needs-location')
        .severity(severity)
        .type('static')
        .summary('A 201 response needs a Location header')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: statusCode(201),
            violatedWhen: (_req, res, location) =>
              res.headers.includes('location')
                ? []
                : [{ location, violation: {}, findings: [] }],
          }),
        )
        .done();

    const format = createThymianFormat();
    const launchesListed = addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
    );
    const launchCreated = addTransaction(
      format,
      createPostRequest({ path: '/launches' }),
      createCreatedResponse({
        headers: { location: createRequiredParameter() },
      }),
    );
    const astronautCreated = addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    it('runs and reports the severity it declares', async () => {
      const executions = await runRule(needsLocation('off')).static(format);

      expect(executions).toMatchObject([
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        { location: { elementId: launchCreated }, status: 'passed' },
        {
          location: { elementId: astronautCreated },
          status: 'failed',
          severity: 'off',
          message: 'A 201 response needs a Location header',
        },
      ]);
      expect(executions).toHaveLength(3);
    });

    it('returns the same executions as with any other severity', async () => {
      const withoutSeverity = async (severity: RuleSeverity) =>
        (await runRule(needsLocation(severity)).static(format)).map(
          ({ severity: _declared, ...execution }) => execution,
        );

      expect(await withoutSeverity('off')).toEqual(
        await withoutSeverity('error'),
      );
    });

    it('leaves the rule it was given as it is', async () => {
      const rule = needsLocation('off');

      await runRule(rule).static(format);

      expect(rule.meta.severity).toBe('off');
    });
  });

  describe('a rule with options', () => {
    const requiresHeader = httpRule('test/created-requires-header')
      .severity('error')
      .type('static')
      .options<{ header: string }>({
        type: 'object',
        properties: { header: { type: 'string' } },
        required: ['header'],
      })
      .rule((ctx, { header }) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: (_req, res, location) =>
            res.headers.includes(header)
              ? []
              : [
                  {
                    location,
                    violation: { message: `missing ${header}` },
                    findings: [],
                  },
                ],
        }),
      )
      .done();

    const format = createThymianFormat();
    const launchCreated = addTransaction(
      format,
      createPostRequest({ path: '/launches' }),
      createCreatedResponse({
        headers: { location: createRequiredParameter() },
      }),
    );

    it('hands the options to the rule function', async () => {
      const executions = await runRule(requiresHeader, {
        options: { header: 'etag' },
      }).static(format);

      expect(executions).toMatchObject([
        {
          location: { elementId: launchCreated },
          status: 'failed',
          message: 'missing etag',
        },
      ]);
    });

    it('gives another result for another configuration of the same rule', async () => {
      const executions = await runRule(requiresHeader, {
        options: { header: 'location' },
      }).static(format);

      expect(executions).toMatchObject([
        { location: { elementId: launchCreated }, status: 'passed' },
      ]);
    });

    it('tells the rule function the context it runs in, beside its options', async () => {
      const seen: unknown[] = [];
      const rule = httpRule('test/records-its-options')
        .severity('error')
        .type('static')
        .options<{ header: string }>({
          type: 'object',
          properties: { header: { type: 'string' } },
          required: ['header'],
        })
        .rule((_ctx, options) => {
          seen.push(options);
          return [];
        })
        .done();

      await runRule(rule, { options: { header: 'etag' } }).static(format);

      expect(seen).toEqual([{ header: 'etag', mode: 'static' }]);
    });
  });

  describe('a rule that skips by itself', () => {
    const skips = (reason?: string) =>
      httpRule('test/skips-created')
        .severity('error')
        .type('static')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: statusCode(201),
            violatedWhen: (_req, _res, location) => [
              {
                location,
                findings: [
                  {
                    kind: 'rule-skip',
                    title: 'skipped',
                    ...(reason === undefined ? {} : { reason }),
                  },
                ],
              },
            ],
          }),
        )
        .done();

    const format = createThymianFormat();
    const launchesListed = addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
    );
    const astronautCreated = addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    it('yields a skipped entry carrying the reason, on the transaction it skipped', async () => {
      const executions = await runRule(
        skips('the specification does not say'),
      ).static(format);

      expect(executions).toMatchObject([
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        {
          location: { elementId: astronautCreated },
          status: 'skipped',
          reason: 'the specification does not say',
        },
      ]);
      expect(executions).toHaveLength(2);
    });

    it('yields a skipped entry without a reason when the rule gave none', async () => {
      const executions = await runRule(skips()).static(format);

      expect(executions[1]).toMatchObject({ status: 'skipped' });
      expect(executions[1]).not.toHaveProperty('reason');
    });
  });

  describe('findings a rule attaches to an execution', () => {
    const notes = httpRule('test/notes-what-it-saw')
      .severity('error')
      .type('static')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: (req, res, location) => [
            {
              location,
              ...(res.headers.includes('location')
                ? {}
                : { violation: { message: 'no Location header' } }),
              findings: [
                {
                  kind: 'informational',
                  title: `looked at ${req.path}`,
                  message: 'the response declares its headers',
                },
              ],
            },
          ],
        }),
      )
      .done();

    const format = createThymianFormat();
    const launchesListed = addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
    );
    const launchCreated = addTransaction(
      format,
      createPostRequest({ path: '/launches' }),
      createCreatedResponse({
        headers: { location: createRequiredParameter() },
      }),
    );
    const astronautCreated = addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    it('come back on a passed entry and on a failed one, as the engine reports them', async () => {
      const executions = await runRule(notes).static(format);

      expect(executions).toEqual([
        expect.objectContaining({
          location: expect.objectContaining({ elementId: launchesListed }),
          status: 'notApplicable',
          findings: [],
        }),
        expect.objectContaining({
          location: expect.objectContaining({ elementId: launchCreated }),
          status: 'passed',
          findings: [
            {
              id: expect.any(String),
              kind: 'informational',
              title: 'looked at /launches',
              message: { text: 'the response declares its headers' },
            },
          ],
        }),
        expect.objectContaining({
          location: expect.objectContaining({ elementId: astronautCreated }),
          status: 'failed',
          message: 'no Location header',
          findings: [
            {
              id: expect.any(String),
              kind: 'informational',
              title: 'looked at /astronauts',
              message: { text: 'the response declares its headers' },
            },
          ],
        }),
      ]);
    });

    it('are an empty list on an entry the engine reported none for', async () => {
      const silent = httpRule('test/says-nothing')
        .severity('error')
        .type('static')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: statusCode(201),
            violatedWhen: (_req, _res, location) => [
              { location, violation: {}, findings: [] },
            ],
          }),
        )
        .done();

      const executions = await runRule(silent).static(format);

      expect(executions.map(({ findings }) => findings)).toEqual([[], [], []]);
    });
  });
});
