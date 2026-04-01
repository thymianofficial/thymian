import { type RenderResult, waitFor } from 'cli-testing-library';
import { filter, firstValueFrom, ReplaySubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import {
  copyFixturesToTempDir,
  fixturesDir,
  renderThymian,
  useTempDir,
} from './helpers.js';
import { getAvailablePort } from './port-utils.js';

describe('thymian serve (websocket)', () => {
  const getTempDir = useTempDir();

  let instance: RenderResult;
  let wsPort: number;

  beforeEach(async () => {
    wsPort = await getAvailablePort();

    // Copy the websocket-serve fixture which has all plugins configured
    // but no port set for @thymian/websocket-proxy.
    copyFixturesToTempDir(`${fixturesDir}/websocket-serve`, getTempDir());

    // Use the -o flag to override the websocket-proxy port at runtime,
    // demonstrating and exercising the reintroduced option flag.
    instance = await renderThymian(
      ['serve', '-o', `@thymian/websocket-proxy.port=${wsPort}`],
      { cwd: getTempDir() },
    );
  });

  afterEach(async () => {
    instance.userEvent.keyboard('q');

    await waitFor(() => expect(instance.hasExit()).not.toBeNull(), {
      timeout: 29_000,
    });
  }, 30_000);

  it('should transform an OpenAPI spec and run a static lint via websocket proxy', async () => {
    const { findByText } = instance;

    await expect(
      findByText(/Thymian is now in "serve" mode/, undefined, {
        timeout: 59_000,
      }),
    ).resolves.toBeTruthy();

    const ws = new WebSocket(`ws://localhost:${wsPort}`);
    console.log('Created WebSocket instance');

    try {
      await new Promise((resolve) => ws.on('open', () => resolve(undefined)));
      console.log('WebSocket opened');

      const message$$ = new ReplaySubject<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: string } & Record<string, any>
      >(1);
      ws.on('message', (data) => message$$.next(JSON.parse(data.toString())));

      // Register as a websocket client
      ws.send(
        JSON.stringify({
          type: 'register',
          name: 'e2e-plugin',
          onActions: [],
          onEvents: [],
        }),
      );

      const registerAck = await firstValueFrom(
        message$$.pipe(filter((msg) => msg.type === 'register-ack')),
      );
      expect(registerAck['ok']).toBe(true);

      ws.send(JSON.stringify({ type: 'ready' }));

      // Transform an OpenAPI spec via the openapi.transform action
      ws.send(
        JSON.stringify({
          id: '1',
          type: 'emitAction',
          name: 'openapi.transform',
          options: { strategy: 'first', timeout: 30_000 },
          payload: {
            content: `openapi: "3.1.0"
info:
  title: "Test API"
  description: "Test API"
  version: "1.0.0"
paths:
  /api/hello:
    get:
      summary: "GET api/hello"
      operationId: "hello"
      parameters:
        - name: "name"
          in: "query"
          required: true
          schema:
            type: "string"
      responses:
        "200":
          description: "OK"
          content:
            '*/*':
              schema:
                $ref: "#/components/schemas/Data"
components:
  schemas:
    Data:
      type: "object"
      properties:
        content:
          type: "string"
      required:
        - "content"`,
          },
        }),
      );

      const openapiTransformResult = await firstValueFrom(
        message$$.pipe(filter((msg) => msg.type === 'emitActionResult')),
      );
      expect(openapiTransformResult['correlationId']).toBe('1');
      expect(openapiTransformResult['name']).toBe('openapi.transform');
      expect(openapiTransformResult['payload']).toBeTruthy();

      // Run a static lint on the transformed format via http-linter.lint-static.
      // No rules are passed explicitly, so the linter returns with no violations.
      // The collect strategy (default) wraps the single response in an array.
      message$$.next({ type: 'clear' });
      ws.send(
        JSON.stringify({
          id: '2',
          type: 'emitAction',
          name: 'http-linter.lint-static',
          payload: {
            format: openapiTransformResult['payload'],
          },
        }),
      );

      const httpLintStaticResult = await firstValueFrom(
        message$$.pipe(filter((msg) => msg.type === 'emitActionResult')),
      );
      expect(httpLintStaticResult['correlationId']).toBe('2');
      expect(httpLintStaticResult['name']).toBe('http-linter.lint-static');
      expect(httpLintStaticResult['payload']).toBeTruthy();

      // The default strategy is 'collect', so the result is an array
      // with one entry from the single http-linter listener.
      const lintResult = httpLintStaticResult.payload[0];
      expect(lintResult).toHaveProperty('valid');
      expect(lintResult).toHaveProperty('violations');
      expect(lintResult).toHaveProperty('reports');

      // Without rules provided, the linter returns valid: true
      expect(lintResult.valid).toBe(true);
      expect(lintResult.violations).toHaveLength(0);
    } finally {
      ws.close();
    }
  }, 120_000);
});
