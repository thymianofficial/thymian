import { type CachedError } from '@thymian/common-cli';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createGithubIssueUrlForError } from '../src/create-github-issue-url-for-error.js';

describe('createGithubIssueUrlForError', () => {
  const originalHome = process.env.HOME;

  beforeEach(() => {
    process.env.HOME = '/home/testuser';
  });

  afterEach(() => {
    process.env.HOME = originalHome;
  });

  it('should generate correct GitHub issue URL', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test error message',
      commandName: 'test:command',
      timestamp: 1234567890000,
      argv: ['node', 'thymian', 'test'],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
        osVersion: 'Linux',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);

    expect(url).toContain(
      'https://github.com/thymianofficial/thymian/issues/new',
    );
  });

  it('should include proper title with error name and command', () => {
    const error: CachedError = {
      name: 'ConfigurationError',
      message: 'Invalid config',
      commandName: 'init',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);

    expect(parsedUrl.searchParams.get('title')).toBe(
      'ConfigurationError while running in command `init`',
    );
  });

  it('should set labels parameter to bug', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);

    expect(parsedUrl.searchParams.get('labels')).toBe('bug');
  });

  it('should include environment details in body', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'arm64',
        cliVersion: '2.0.0',
        nodeVersion: 'v20.0.0',
        osVersion: 'Darwin 23.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('**CLI Version:** `2.0.0`');
    expect(body).toContain('**Node Version:** `v20.0.0`');
    expect(body).toContain('**OS:** `Darwin 23.0.0` (arm64)');
    expect(body).toContain('**Command:** `test');
  });

  it('should include plugin table in collapsible section', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [
        { name: '@thymian/plugin-openapi', version: '1.0.0' },
        { name: '@thymian/plugin-http-linter', version: '2.0.0' },
      ],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('🔌 Installed Plugins');
    expect(body).toContain('| @thymian/plugin-openapi | 1.0.0 |');
    expect(body).toContain('| @thymian/plugin-http-linter | 2.0.0 |');
  });

  it('should show "none" when no plugins installed', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('| none | - |');
  });

  it('should include stack trace in collapsible code block', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test error',
      stack: 'Error: Test error\n  at test.ts:10\n  at run.ts:20',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('Click to expand Stacktrace');
    expect(body).toContain('```text');
    expect(body).toContain('Error: Test error');
    expect(body).toContain('at test.ts:10');
  });

  it('should handle missing stack trace gracefully', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('_No stacktrace available._');
    expect(body).not.toContain('Click to expand Stacktrace');
  });

  it('should replace HOME directory with ~ in stack traces', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      stack: `Error: Test\n  at /home/testuser/project/src/test.ts:10\n  at /home/testuser/.config/test.js:20`,
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('~/project/src/test.ts:10');
    expect(body).toContain('~/.config/test.js:20');
    expect(body).not.toContain('/home/testuser');
  });

  it('should handle missing osVersion gracefully', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('**OS:** `N/A` (x64)');
  });

  it('should format timestamp correctly', () => {
    const timestamp = 1234567890000;
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp,
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    const expectedTimestamp = new Date(timestamp).toLocaleString();
    expect(body).toContain(`**Timestamp:** ${expectedTimestamp}`);
  });

  it('should include markdown formatting for body', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('### 📝 Description');
    expect(body).toContain('### 💻 Environment');
    expect(body).toContain('### 🔍 Error Details');
    expect(body).toContain('*Reported via `thymian feedback`*');
  });

  it('should include details tags for collapsible sections', () => {
    const error: CachedError = {
      name: 'TestError',
      message: 'Test',
      stack: 'Error: Test\n  at test.ts:10',
      commandName: 'test',
      timestamp: Date.now(),
      argv: [],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
      },
      pluginVersions: [{ name: '@thymian/plugin-openapi', version: '1.0.0' }],
    };

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('<details>');
    expect(body).toContain('<summary>');
    expect(body).toContain('</details>');
    expect(body).toContain('</summary>');
  });
});
