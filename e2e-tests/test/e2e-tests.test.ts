import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { render, type RenderResult, waitFor } from 'cli-testing-library';
import fastify from 'fastify';
import { filter, firstValueFrom, ReplaySubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { getAvailablePort } from './port-utils.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

type InstallationMode = 'npx' | 'global' | 'local';
const installationMode: InstallationMode =
  (process.env.THYMIAN_E2E_MODE as InstallationMode) || 'npx';

function renderThymian(args: string[], opts?: { cwd?: string }) {
  const version = process.env.THYMIAN_E2E_VERSION ?? '';
  switch (installationMode) {
    case 'npx':
      return render('npx', ['--yes', `@thymian/cli@${version}`, ...args], opts);
    case 'global':
      return render(
        process.env.THYMIAN_E2E_GLOBAL_BIN ?? 'thymian',
        args,
        opts,
      );
    case 'local':
      throw new Error('Local installation mode not yet implemented');
  }
}

describe('E2E test Thymian', () => {
  let e2eTempDir: string;

  beforeEach(() => {
    e2eTempDir = mkdtempSync(join(tmpdir(), 'thymian-e2e-'));
    console.log(`Created e2e test temp dir: ${e2eTempDir}`);
  });

  afterEach(() => {
    console.log(`Removing e2e test temp dir: ${e2eTempDir}`);
    rmSync(e2eTempDir, { recursive: true, force: true });
  });

  describe('using cli', () => {
    it(
      'should print the standard message',
      async () => {
        console.log('=> should print the standard message');
        const { findByText } = await renderThymian([], {
          cwd: e2eTempDir,
        });

        await expect(
          findByText(/VERSION/, undefined, { timeout: 59000 }),
        ).resolves.toBeTruthy();
      },
      { timeout: 60000 },
    );

    it(
      'should initialize Thymian',
      async () => {
        const { findByText } = await renderThymian(['init', '--yes'], {
          cwd: e2eTempDir,
        });

        await expect(
          findByText(/Initialized Thymian/, undefined, { timeout: 89000 }),
        ).resolves.toBeTruthy();

        expect(existsSync(join(e2eTempDir, 'thymian.config.yaml'))).toBe(true);
      },
      { timeout: 90000 },
    );

    it(
      'should run a static check',
      async () => {
        copyFixturesToTempDir(join(fixturesDir, 'static-lint'), e2eTempDir);

        const { findByText } = await renderThymian(['run'], {
          cwd: e2eTempDir,
        });

        await expect(
          findByText(/Static Checks/, undefined, { timeout: 89000 }),
        ).resolves.toBeTruthy();
      },
      { timeout: 90000 },
    );

    it(
      'should generate samples and run a dynamic check',
      async () => {
        copyFixturesToTempDir(join(fixturesDir, 'samples/'), e2eTempDir);

        const { findByText } = await renderThymian(
          ['sampler:init', '--no-check'],
          {
            cwd: e2eTempDir,
          },
        );

        await expect(
          findByText(/Sampler initialized/, undefined, { timeout: 89000 }),
        ).resolves.toBeTruthy();

        expect(existsSync(join(e2eTempDir, '.thymian'))).toBe(true);

        const port = await getAvailablePort();

        const openapiPath = join(e2eTempDir, 'test.openapi.yaml');
        const openapiContent = readFileSync(openapiPath, 'utf-8');
        writeFileSync(
          openapiPath,
          openapiContent.replace(
            'http://localhost:3000',
            `http://localhost:${port}`,
          ),
        );

        const server = fastify();
        server.get<{ Querystring: { name: string } }>(
          '/api/hello',
          async (req) => {
            const { name } = req.query;
            return { content: `Hello ${name}` };
          },
        );
        await server.listen({ port, host: '0.0.0.0' });

        try {
          const { findByText } = await renderThymian(['format:check'], {
            cwd: e2eTempDir,
          });

          await expect(
            findByText(/GET \/api\/hello → 200 OK/, undefined, {
              timeout: 89000,
            }),
          ).resolves.toBeTruthy();
        } finally {
          await server.close();
        }
      },
      { timeout: 180000 },
    );
  });

  describe('using websocket', () => {
    let instance: RenderResult;
    let wsPort: number;

    beforeEach(async () => {
      wsPort = await getAvailablePort();
      instance = await renderThymian([
        'serve',
        '-o',
        `@thymian/websocket-proxy.port=${wsPort}`,
      ]);
    });

    afterEach(async () => {
      instance.userEvent.keyboard('q');

      await waitFor(() => expect(instance.hasExit()).not.toBeNull(), {
        timeout: 29000,
      });
    }, 30000);

    it(
      'should run a static check via webproxy plugin',
      async () => {
        const { findByText } = instance;

        await expect(
          findByText(/Thymian is now in "serve" mode/, undefined, {
            timeout: 59000,
          }),
        ).resolves.toBeTruthy();

        const ws = new WebSocket(`ws://localhost:${wsPort}`);
        console.log('Created WebSocket instance');

        try {
          await new Promise((resolve) =>
            ws.on('open', () => resolve(undefined)),
          );
          console.log('WebSocket opened');

          const message$$ = new ReplaySubject<
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { type: string } & Record<string, any>
          >(1);
          ws.on('message', (data) =>
            message$$.next(JSON.parse(data.toString())),
          );

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

          ws.send(
            JSON.stringify({
              id: '1',
              type: 'emitAction',
              name: 'openapi.transform',
              options: { strategy: 'first', timeout: 30000 },
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
          expect(
            httpLintStaticResult.payload[0].reports.length,
          ).toBeGreaterThan(0);
          expect(httpLintStaticResult.payload[0].valid).toBe(false); // there are warnings
        } finally {
          ws.close();
        }
      },
      { timeout: 120000 },
    );
  });
});

function copyFixturesToTempDir(sourceDir: string, tempDir: string) {
  cpSync(sourceDir, tempDir, { recursive: true, force: true });
}
