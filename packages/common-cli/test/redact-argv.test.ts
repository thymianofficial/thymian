import { describe, expect, it } from 'vitest';

import { redactArgv, REDACTED, scrubSecrets } from '../src/redact-argv.js';

const BASE = ['/usr/bin/node', '/usr/local/bin/thymian'];
const SECRET = 'ghp_s3cr3tT0ken';

const redact = (tail: string[], ...commandId: [string?]) =>
  redactArgv([...BASE, ...tail], commandId.length ? commandId[0] : 'lint');

describe('redactArgv', () => {
  it('keeps the node and bin entries and the command words', () => {
    expect(redact(['lint'], 'lint').argv).toEqual([...BASE, 'lint']);
    expect(redact(['generate', 'config'], 'generate:config').argv).toEqual([
      ...BASE,
      'generate',
      'config',
    ]);
    expect(redact(['generate:config'], 'generate:config').argv).toEqual([
      ...BASE,
      'generate:config',
    ]);
  });

  it('keeps the command words as typed when they differ from the resolved id', () => {
    // A "did you mean …?" suggestion ran `generate:config` for `generate confi`.
    expect(
      redact(['generate', 'confi', '--bogus'], 'generate:config').argv,
    ).toEqual([...BASE, 'generate', 'confi', '--bogus']);
  });

  it('redacts a positional argument after the command words', () => {
    const result = redact(
      ['openapi', 'load', `https://user:${SECRET}@example.com/spec.yaml`],
      'openapi:load',
    );

    expect(result.argv).toEqual([...BASE, 'openapi', 'load', REDACTED]);
  });

  it('does not count a colon-joined command word twice', () => {
    expect(redact(['explain:rule', SECRET], 'explain:rule').argv).toEqual([
      ...BASE,
      'explain:rule',
      REDACTED,
    ]);
  });

  it('keeps no command words when the command id is unknown', () => {
    expect(redact([SECRET, '--debug'], undefined).argv).toEqual([
      ...BASE,
      REDACTED,
      '--debug',
    ]);
  });

  it.each([
    ['--flag value', ['--token', SECRET], ['--token', REDACTED]],
    ['--flag=value', [`--token=${SECRET}`], [`--token=${REDACTED}`]],
    ['-f value', ['-t', SECRET], ['-t', REDACTED]],
    ['-fvalue', [`-t${SECRET}`], [`-t${REDACTED}`]],
    ['-f=value', [`-t=${SECRET}`], [`-t=${REDACTED}`]],
    [
      '-o key=value',
      ['-o', `some-plugin.auth.token=${SECRET}`],
      ['-o', `some-plugin.auth.token=${REDACTED}`],
    ],
    [
      '--option key=value',
      ['--option', `@thymian/plugin-x.items[0].token=${SECRET}`],
      ['--option', `@thymian/plugin-x.items[0].token=${REDACTED}`],
    ],
    [
      '--option=key=value',
      [`--option=some-plugin.auth.token=${SECRET}`],
      [`--option=some-plugin.auth.token=${REDACTED}`],
    ],
    [
      '-okey=value',
      [`-osome-plugin.auth.token=${SECRET}`],
      [`-osome-plugin.auth.token=${REDACTED}`],
    ],
    [
      'a URL value with a query token',
      ['--spec', `openapi:https://example.com/spec?token=${SECRET}`],
      ['--spec', REDACTED],
    ],
    [
      'a URL value with userinfo',
      [`--traffic=har:https://u:${SECRET}@example.com/t.har`],
      [`--traffic=${REDACTED}`],
    ],
    [
      'everything after --',
      ['--debug', '--', '--token', SECRET],
      ['--debug', '--', REDACTED, REDACTED],
    ],
  ])('redacts the value in the %s form', (_form, tail, expected) => {
    const result = redact(['lint', ...tail]);

    expect(result.argv).toEqual([...BASE, 'lint', ...expected]);
    expect(JSON.stringify(result.argv)).not.toContain(SECRET);
    expect(result.secrets).toContain(SECRET);
  });

  it('keeps flag names, boolean flags and their order', () => {
    expect(
      redact([
        'lint',
        '--debug',
        '--no-guidance',
        '--config',
        'thymian.yaml',
        '-d',
        '-',
      ]).argv,
    ).toEqual([
      ...BASE,
      'lint',
      '--debug',
      '--no-guidance',
      '--config',
      REDACTED,
      '-d',
      '-',
    ]);
  });

  it('does not mutate the argv it is given', () => {
    const argv = [...BASE, 'lint', '--token', SECRET];

    redactArgv(argv, 'lint');

    expect(argv).toEqual([...BASE, 'lint', '--token', SECRET]);
  });
});

describe('scrubSecrets', () => {
  it('replaces every secret in strings, nested arrays and objects', () => {
    const scrubbed = scrubSecrets(
      {
        message: `Invalid option format: "x.token=${SECRET}"`,
        nested: [{ url: `https://u:${SECRET}@example.com` }, 42, null],
      },
      [SECRET],
    );

    expect(scrubbed).toEqual({
      message: `Invalid option format: "x.token=${REDACTED}"`,
      nested: [{ url: `https://u:${REDACTED}@example.com` }, 42, null],
    });
  });

  it('leaves values shorter than the minimum secret length alone', () => {
    // A short value such as `info` or `yaml` would otherwise mangle the stack.
    expect(scrubSecrets('at Info.run (info.js)', ['info'])).toBe(
      'at Info.run (info.js)',
    );
  });

  it('survives cyclic objects', () => {
    const cyclic: Record<string, unknown> = { token: SECRET };
    cyclic['self'] = cyclic;

    expect(() => scrubSecrets(cyclic, [SECRET])).not.toThrow();
  });
});
