import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createGithubIssueUrlForError } from '../src/create-github-issue-url-for-error.js';
import { aCachedError } from './support/cached-error.js';

describe('createGithubIssueUrlForError', () => {
  const originalHome = process.env.HOME;

  beforeEach(() => {
    process.env.HOME = '/home/testuser';
  });

  afterEach(() => {
    process.env.HOME = originalHome;
  });

  it('should generate correct GitHub issue URL', () => {
    const error = aCachedError({
      message: 'Test error message',
      commandName: 'test:command',
      argv: ['node', 'thymian', 'test'],
      version: {
        architecture: 'x64',
        cliVersion: '1.0.0',
        nodeVersion: 'v18.0.0',
        osVersion: 'Linux',
      },
    });

    const url = createGithubIssueUrlForError(error);

    expect(url).toContain(
      'https://github.com/thymianofficial/thymian/issues/new',
    );
  });

  it('should include proper title with error name and command', () => {
    const error = aCachedError({
      name: 'ConfigurationError',
      message: 'Invalid config',
      commandName: 'init',
    });

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);

    expect(parsedUrl.searchParams.get('title')).toBe(
      'ConfigurationError while running in command `init`',
    );
  });

  it('should set labels parameter to bug', () => {
    const error = aCachedError();

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);

    expect(parsedUrl.searchParams.get('labels')).toBe('bug');
  });

  it('should include environment details in body', () => {
    const error = aCachedError({
      version: {
        architecture: 'arm64',
        cliVersion: '2.0.0',
        nodeVersion: 'v20.0.0',
        osVersion: 'Darwin 23.0.0',
      },
    });

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('**CLI Version:** `2.0.0`');
    expect(body).toContain('**Node Version:** `v20.0.0`');
    expect(body).toContain('**OS:** `Darwin 23.0.0` (arm64)');
    expect(body).toContain('**Command:** `test`');
  });

  it('should render the command name with nothing after it', () => {
    const error = aCachedError({
      commandName: 'lint',
    });

    const body = new URL(createGithubIssueUrlForError(error)).searchParams.get(
      'body',
    );

    expect(body?.split('\n')).toContain('- **Command:** `lint`');
  });

  // The record is read back from last_error.json without validation, so an
  // older or hand-edited record can lack a command name despite the type.
  it.each([
    ['missing', undefined],
    ['empty', ''],
  ])('should render no command when the command name is %s', (_, value) => {
    const error = aCachedError({ commandName: value });

    const parsedUrl = new URL(createGithubIssueUrlForError(error));
    const title = parsedUrl.searchParams.get('title');
    const body = parsedUrl.searchParams.get('body');

    expect(body?.split('\n')).toContain('- **Command:**');
    expect(body).not.toContain('undefined');
    expect(body).not.toContain("|| ''");
    expect(title).toBe('TestError');
  });

  it('should include plugin table in collapsible section', () => {
    const error = aCachedError({
      pluginVersions: [
        { name: '@thymian/plugin-openapi', version: '1.0.0' },
        { name: '@thymian/plugin-http-linter', version: '2.0.0' },
      ],
    });

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('🔌 Installed Plugins');
    expect(body).toContain('| @thymian/plugin-openapi | 1.0.0 |');
    expect(body).toContain('| @thymian/plugin-http-linter | 2.0.0 |');
  });

  it('should show "none" when no plugins installed', () => {
    const error = aCachedError();

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('| none | - |');
  });

  it('should include stack trace in collapsible code block', () => {
    const error = aCachedError({
      message: 'Test error',
      stack: 'Error: Test error\n  at test.ts:10\n  at run.ts:20',
    });

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('Click to expand Stacktrace');
    expect(body).toContain('```text');
    expect(body).toContain('Error: Test error');
    expect(body).toContain('at test.ts:10');
  });

  it('should handle missing stack trace gracefully', () => {
    const error = aCachedError();

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('_No stacktrace available._');
    expect(body).not.toContain('Click to expand Stacktrace');
  });

  it('should replace HOME directory with ~ in stack traces', () => {
    const error = aCachedError({
      stack: `Error: Test\n  at /home/testuser/project/src/test.ts:10\n  at /home/testuser/.config/test.js:20`,
    });

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('~/project/src/test.ts:10');
    expect(body).toContain('~/.config/test.js:20');
    expect(body).not.toContain('/home/testuser');
  });

  it('should handle missing osVersion gracefully', () => {
    const error = aCachedError();

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('**OS:** `N/A` (x64)');
  });

  it('should format timestamp correctly', () => {
    const timestamp = 1234567890000;
    const error = aCachedError({
      timestamp,
    });

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    const expectedTimestamp = new Date(timestamp).toLocaleString();
    expect(body).toContain(`**Timestamp:** ${expectedTimestamp}`);
  });

  it('should include markdown formatting for body', () => {
    const error = aCachedError();

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('### 📝 Description');
    expect(body).toContain('### 💻 Environment');
    expect(body).toContain('### 🔍 Error Details');
    expect(body).toContain('*Reported via `thymian feedback`*');
  });

  it('should include details tags for collapsible sections', () => {
    const error = aCachedError({
      stack: 'Error: Test\n  at test.ts:10',
      pluginVersions: [{ name: '@thymian/plugin-openapi', version: '1.0.0' }],
    });

    const url = createGithubIssueUrlForError(error);
    const parsedUrl = new URL(url);
    const body = parsedUrl.searchParams.get('body');

    expect(body).toContain('<details>');
    expect(body).toContain('<summary>');
    expect(body).toContain('</details>');
    expect(body).toContain('</summary>');
  });
});
