import { spawnSync } from 'node:child_process';
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

import { getCleanEnv } from './env-utils.js';
import { getAvailablePort } from './port-utils.js';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

type InstallationMode = 'npx' | 'global' | 'local';
const validModes: InstallationMode[] = ['npx', 'global', 'local'];
const rawMode = process.env.THYMIAN_E2E_MODE || 'npx';
if (!validModes.includes(rawMode as InstallationMode)) {
  throw new Error(
    `Invalid THYMIAN_E2E_MODE: '${rawMode}'. Must be one of: ${validModes.join(', ')}`,
  );
}
const installationMode: InstallationMode = rawMode as InstallationMode;

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

function execThymian(
  args: string[],
  opts: { cwd?: string; allowFailure?: boolean } = {},
): string {
  const version = process.env.THYMIAN_E2E_VERSION ?? '';
  const env = getCleanEnv();
  let cmd: string;
  let argv: string[];
  switch (installationMode) {
    case 'npx':
      cmd = npxCmd;
      argv = ['--yes', `@thymian/cli@${version}`, ...args];
      break;
    case 'global': {
      cmd = process.env.THYMIAN_E2E_GLOBAL_BIN ?? 'thymian';
      argv = args;
      break;
    }
    case 'local':
      throw new Error('Local installation mode not yet implemented');
  }
  const result = spawnSync(cmd, argv, {
    cwd: opts.cwd,
    env,
    encoding: 'utf-8',
    timeout: 90_000,
  });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  if (result.status !== 0) {
    console.warn(
      `execThymian exited with status ${result.status ?? 'unknown'}`,
    );
    if (output) {
      console.warn(output);
    }
    if (opts.allowFailure) {
      return output;
    }
    const err = new Error(
      `execThymian failed with status ${result.status ?? 'unknown'}.\n\nOutput:\n${output}`,
    );
    throw err;
  }
  return output;
}

function renderThymian(args: string[], opts?: { cwd?: string }) {
  const version = process.env.THYMIAN_E2E_VERSION ?? '';
  const env = getCleanEnv();
  switch (installationMode) {
    case 'npx':
      return render('npx', ['--yes', `@thymian/cli@${version}`, ...args], {
        ...opts,
        env,
      });
    case 'global':
      return render(process.env.THYMIAN_E2E_GLOBAL_BIN ?? 'thymian', args, {
        ...opts,
        env,
      });
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
      () => {
        const output = execThymian([], { cwd: e2eTempDir });
        expect(output).toMatch(/VERSION/);
      },
      { timeout: 90000 },
    );

    it(
      'should initialize Thymian',
      () => {
        const output = execThymian(['init', '--yes'], { cwd: e2eTempDir });
        expect(output).toMatch(/Initialized Thymian/);
        expect(existsSync(join(e2eTempDir, 'thymian.config.yaml'))).toBe(true);
      },
      { timeout: 90000 },
    );

    it(
      'should run a static check',
      () => {
        copyFixturesToTempDir(join(fixturesDir, 'static-lint'), e2eTempDir);
        const output = execThymian(['run'], {
          cwd: e2eTempDir,
          allowFailure: true,
        });
        expect(output).toMatch(/Static Checks/);
      },
      { timeout: 90000 },
    );

    // TODO: Skipped — dynamic check fails with RequestDispatchError in CI.
    // Will be addressed during the architecture refactor.
    it.skip(
      'should generate samples and run a dynamic check',
      async () => {
        copyFixturesToTempDir(join(fixturesDir, 'samples/'), e2eTempDir);

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

        // Re-init samples after changing the OpenAPI file so the version hash matches
        const samplerOutput = execThymian(['sampler:init', '--no-check'], {
          cwd: e2eTempDir,
        });
        expect(samplerOutput).toMatch(/Sampler initialized/);
        expect(existsSync(join(e2eTempDir, '.thymian'))).toBe(true);

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
          const output = execThymian(['format:check'], { cwd: e2eTempDir });
          expect(output).toMatch(/GET \/api\/hello → 200 OK/);
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
