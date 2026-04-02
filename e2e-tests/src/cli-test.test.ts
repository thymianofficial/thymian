import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymian,
  execThymianRaw,
  execThymianRawAsync,
  fixturesDir,
  useTempDir,
} from './helpers.js';
import { getAvailablePort } from './port-utils.js';

/**
 * Helper: copy a fixture to temp dir, run `sampler:init`, and start a test server.
 * Returns the server and its port so tests can use `--target-url`.
 */
async function setupTestEnvironment(
  fixtureName: string,
  tempDir: string,
  handler: (
    server: ReturnType<typeof fastify>,
  ) => void = addDefaultHelloHandler,
) {
  copyFixturesToTempDir(join(fixturesDir, fixtureName), tempDir);

  // Generate samples so the sampler plugin can produce request templates
  execThymian(['sampler', 'init'], { cwd: tempDir });

  const port = await getAvailablePort();
  const server = fastify();
  handler(server);
  await server.listen({ port, host: '0.0.0.0' });

  return { server, port, targetUrl: `http://localhost:${port}` };
}

function addDefaultHelloHandler(server: ReturnType<typeof fastify>) {
  server.get<{ Querystring: { name: string } }>('/api/hello', async (req) => {
    const { name } = req.query;
    return { content: `Hello ${name}` };
  });
}

describe('thymian test', () => {
  const getTempDir = useTempDir();

  // ─── Happy Path ──────────────────────────────────────────────────────

  it('should run a dynamic API test with --target-url and exit 0 on clean run', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Found 0 errors/);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('should include test rule results in output', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      // Output should contain rule result summaries
      expect(result.output).toMatch(/Found 0 errors/);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── --target-url Overrides Spec Servers ──────────────────────────

  it('should override spec server URL with --target-url', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      // The spec says localhost:3000, but --target-url should redirect requests
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      // If target-url wasn't applied, requests would go to port 3000 and fail
      expect(result.exitCode).toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('should use --target-url with a spec that has no servers defined', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test-no-servers',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Exit Code Semantics ──────────────────────────────────────────

  it('should report skipped test cases when server returns unexpected status', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
      (s) => {
        // Return 501 Not Implemented — rules skip when the initial response
        // does not match the expected status from the OpenAPI spec.
        s.get('/api/hello', async (_req, reply) => {
          await reply.status(501).send({ error: 'Not Implemented' });
        });
      },
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir(), allowFailure: true },
      );

      // Skipped test cases are not violations, so exit code remains 0
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/test case skipped/);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('should exit 2 when server is unreachable (tool error)', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    // Use a port that has nothing listening — no server in this test, so
    // spawnSync is fine (no event-loop contention).
    const port = await getAvailablePort();
    const result = execThymianRaw(
      ['test', '--target-url', `http://localhost:${port}`],
      { cwd: getTempDir(), allowFailure: true },
    );

    // ECONNREFUSED causes a tool-error → exit code 2
    expect(result.exitCode).toBe(2);
  }, 180_000);

  it('should exit 1 when violations are found', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        [
          'test',
          '--target-url',
          targetUrl,
          '--rule-severity',
          'warn',
          '--rule-set',
          '@thymian/rfc-9110-rules',
        ],
        { cwd: getTempDir(), allowFailure: true },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toMatch(/ \d+ warnings?/);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── --spec Flag ──────────────────────────────────────────────────

  it('should accept specification via --spec flag', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        [
          'test',
          '--spec',
          'openapi:test.openapi.yaml',
          '--target-url',
          targetUrl,
        ],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── --rule-set Flag ──────────────────────────────────────────────

  it('should accept rule sets via --rule-set flag', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        [
          'test',
          '--rule-set',
          '@thymian/rfc-9110-rules',
          '--target-url',
          targetUrl,
        ],
        { cwd: getTempDir() },
      );

      expect(result.output).toMatch(/Found 0 errors/);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Output Format ────────────────────────────────────────────────

  it('should produce structured output with reporter', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      // Reporter output should be on stdout
      expect(result.stdout.length).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Stderr vs Stdout Separation ──────────────────────────────────

  it('should write report output to stdout, not stderr', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      // The main report text should be on stdout
      expect(result.stdout).toMatch(/Found 0 errors/);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Deterministic Output ─────────────────────────────────────────

  it('should produce deterministic output across consecutive runs', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const run1 = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );
      const run2 = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      // Both runs should produce the same exit code
      expect(run1.exitCode).toBe(run2.exitCode);

      // Both runs should match on the rules run output
      expect(run1.stdout).toMatch(/Found 0 errors/);
      expect(run2.stdout).toMatch(/Found 0 errors/);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Missing Specification ────────────────────────────────────────

  it('should exit 2 when no specification is configured', async () => {
    const result = execThymianRaw(['test'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).toBe(2);
    expect(result.output).toMatch(/No specification/i);
  }, 180_000);

  // ─── Config-based targetUrl ───────────────────────────────────────

  it('should read targetUrl from config file', async () => {
    const port = await getAvailablePort();
    const server = fastify();
    addDefaultHelloHandler(server);
    await server.listen({ port, host: '0.0.0.0' });

    try {
      copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
      execThymian(['sampler', 'init'], { cwd: getTempDir() });

      // Write config with targetUrl baked in
      const configPath = join(getTempDir(), 'thymian.config.yaml');
      const configContent = readFileSync(configPath, 'utf-8');
      writeFileSync(
        configPath,
        configContent + `targetUrl: 'http://localhost:${port}'\n`,
      );

      const result = await execThymianRawAsync(['test'], {
        cwd: getTempDir(),
      });

      expect(result.exitCode).toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);
});
