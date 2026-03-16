import { execFileSync } from 'node:child_process';

import { execSync } from 'child_process';
import { render, type RenderResult, waitFor } from 'cli-testing-library';
import fastify from 'fastify';
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { filter, firstValueFrom, ReplaySubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { thymianVersion } from './global.setup.js';

const dirname = import.meta.dirname;
const fixturesDir = join(dirname, '..', 'fixtures');
const e2eTempDir =
  process.env.TARGET_FOLDER || join(process.cwd(), 'tmp-e2e-test');

const thymianConfigPath = join(e2eTempDir, 'thymian.config.yaml');

const thymianBin = 'thymian';

// function runCommand(cmd: string, args: string[]): string {
//   const result = execFileSync(cmd, args, {
//     cwd: e2eTempDir,
//   });
//   return result.toString();
// }

describe('E2E test Thymian', () => {
  beforeEach(() => {
    console.log('Creating e2e test temp dir');
    mkdirSync(e2eTempDir, { recursive: true });
  });

  afterEach(() => {
    console.log('Removing e2e test temp dir');
    rmSync(e2eTempDir, { recursive: true, force: true });
  });

  describe('using cli', () => {
    it(
      'should print the standard message',
      async () => {
        console.log('=> should print the standard message');
        const { findByText } = await render(thymianBin, [], {
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
        const { findByText } = await render(thymianBin, ['init', '--yes'], {
          cwd: e2eTempDir,
        });

        await expect(
          findByText(/Initialized Thymian/, undefined, { timeout: 89000 }),
        ).resolves.toBeTruthy();

        expect(existsSync(thymianConfigPath)).toBe(true);
      },
      { timeout: 90000 },
    );

    it(
      'should run a static check',
      async () => {
        copyFixturesToTempDir(join(fixturesDir, 'static-lint'));

        const { findByText } = await render(thymianBin, ['run'], {
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
        copyFixturesToTempDir(join(fixturesDir, 'samples/'));

        const { findByText } = await render(
          thymianBin,
          ['sampler:init', '--no-check'],
          {
            cwd: e2eTempDir,
          },
        );

        await expect(
          findByText(/Sampler initialized/, undefined, { timeout: 89000 }),
        ).resolves.toBeTruthy();

        expect(existsSync(join(e2eTempDir, '.thymian'))).toBe(true);

        const server = fastify();
        server.get<{ Querystring: { name: string } }>(
          '/api/hello',
          async (req) => {
            const { name } = req.query;
            return { content: `Hello ${name}` };
          },
        );
        await server.listen({ port: 3000, host: '0.0.0.0' });

        try {
          const { findByText } = await render(thymianBin, ['format:check'], {
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

  // describe('using websocket', () => {
  //   let instance: RenderResult;
  //
  //   beforeEach(async () => {
  //     instance = await render(thymianBin, [
  //       'serve',
  //       '-o',
  //       '@thymian/websocket-proxy.port=51234',
  //     ]);
  //   });
  //
  //   afterEach(async () => {
  //     instance.userEvent.keyboard('q');
  //
  //     await waitFor(
  //       () => expect(instance.hasExit()).toMatchObject({ exitCode: 1 }),
  //       { timeout: 60000 },
  //     );
  //   });
  //
  //   it(
  //     'should run a static check via webproxy plugin',
  //     async () => {
  //       const { findByText } = instance;
  //
  //       await expect(
  //         findByText(/Thymian is now in "serve" mode/, undefined, {
  //           timeout: 59000,
  //         }),
  //       ).resolves.toBeTruthy();
  //
  //       const ws = new WebSocket('ws://localhost:51234');
  //
  //       try {
  //         await new Promise((resolve) =>
  //           ws.on('open', () => resolve(undefined)),
  //         );
  //
  //         const message$$ = new ReplaySubject<
  //           // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //           { type: string } & Record<string, any>
  //         >(1);
  //         ws.on('message', (data) =>
  //           message$$.next(JSON.parse(data.toString())),
  //         );
  //
  //         ws.send(
  //           JSON.stringify({
  //             type: 'register',
  //             name: 'e2e-plugin',
  //             onActions: [],
  //             onEvents: [],
  //           }),
  //         );
  //
  //         const registerAck = await firstValueFrom(
  //           message$$.pipe(filter((msg) => msg.type === 'register-ack')),
  //         );
  //         expect(registerAck['ok']).toBe(true);
  //
  //         ws.send(JSON.stringify({ type: 'ready' }));
  //
  //         ws.send(
  //           JSON.stringify({
  //             id: '1',
  //             type: 'emitAction',
  //             name: 'openapi.transform',
  //             options: { strategy: 'first', timeout: 59000 },
  //             payload: {
  //               content: `openapi: 3.1.0
  //   info:
  //     title: 'Test API'
  //     description: 'Test API'
  //     version: '1.0.0'
  //   paths:
  //     /api/hello:
  //       get:
  //         summary: 'GET api/hello'
  //         operationId: 'hello'
  //         parameters:
  //           - name: 'name'
  //             in: 'query'
  //             required: true
  //             schema:
  //               type: 'string'
  //         responses:
  //           '200':
  //             description: 'OK'
  //             content:
  //               '*/*':
  //                 schema:
  //                   $ref: '#/components/schemas/Data'
  //   components:
  //     schemas:
  //       Data:
  //         type: 'object'
  //         properties:
  //           content:
  //             type: 'string'
  //         required:
  //           - 'content'
  //   `,
  //             },
  //           }),
  //         );
  //
  //         const openapiTransformResult = await firstValueFrom(
  //           message$$.pipe(filter((msg) => msg.type === 'emitActionResult')),
  //         );
  //         expect(openapiTransformResult['correlationId']).toBe('1');
  //         expect(openapiTransformResult['name']).toBe('openapi.transform');
  //
  //         message$$.next({ type: 'clear' });
  //         ws.send(
  //           JSON.stringify({
  //             id: '2',
  //             type: 'emitAction',
  //             name: 'http-linter.lint-static',
  //             payload: {
  //               format: openapiTransformResult['payload'],
  //             },
  //           }),
  //         );
  //
  //         const httpLintStaticResult = await firstValueFrom(
  //           message$$.pipe(filter((msg) => msg.type === 'emitActionResult')),
  //         );
  //         expect(httpLintStaticResult['correlationId']).toBe('2');
  //         expect(httpLintStaticResult['name']).toBe('http-linter.lint-static');
  //         expect(httpLintStaticResult['payload']).toBeTruthy();
  //         expect(
  //           httpLintStaticResult.payload[0].reports.length,
  //         ).toBeGreaterThan(0);
  //         expect(httpLintStaticResult.payload[0].valid).toBe(false); // there are warnings
  //       } finally {
  //         ws.close();
  //       }
  //     },
  //     { timeout: 120000 },
  //   );
  // });
});

function copyFixturesToTempDir(fixturesDir: string) {
  cpSync(fixturesDir, e2eTempDir, { recursive: true, force: true });
}
