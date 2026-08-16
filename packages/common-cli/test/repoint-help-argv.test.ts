import { describe, expect, it } from 'vitest';

import { argvForHelpError } from '../src/repoint-help-argv.js';

const BASE = ['/usr/bin/node', '/usr/local/bin/thymian'];

/** Shape a synthetic oclif parse error with the fields the helper reads. */
const helpError = (id?: string) => ({
  showHelp: true,
  parse: { input: { context: { id } } },
});

describe('argvForHelpError', () => {
  it('repoints argv at the resolved command id, dropping the original tail', () => {
    // User typed `thymian explain my-rule --foo`; the suggestion re-ran
    // `explain:rule`, which failed a required-arg parse.
    const argv = [...BASE, 'explain', 'my-rule', '--foo'];

    expect(argvForHelpError(helpError('explain:rule'), argv)).to.deep.equal([
      ...BASE,
      'explain',
      'rule',
    ]);
  });

  it('splits a deep command id on the topic separator', () => {
    expect(
      argvForHelpError(helpError('generate:config'), [
        ...BASE,
        'generate',
        'confi',
      ]),
    ).to.deep.equal([...BASE, 'generate', 'config']);
  });

  it('returns undefined when the error does not request help', () => {
    const err = {
      showHelp: false,
      parse: { input: { context: { id: 'explain:rule' } } },
    };

    expect(argvForHelpError(err, [...BASE, 'explain'])).to.equal(undefined);
  });

  it('returns undefined when no resolved command id is available', () => {
    expect(argvForHelpError({ showHelp: true }, [...BASE, 'explain'])).to.equal(
      undefined,
    );
    expect(
      argvForHelpError({ showHelp: true, parse: { input: { context: {} } } }, [
        ...BASE,
        'explain',
      ]),
    ).to.equal(undefined);
  });

  it('returns undefined for a non-error / nullish input', () => {
    expect(argvForHelpError(undefined, BASE)).to.equal(undefined);
    expect(argvForHelpError(new Error('boom'), BASE)).to.equal(undefined);
  });

  it('tolerates a short argv without throwing', () => {
    expect(argvForHelpError(helpError('explain:rule'), [])).to.deep.equal([
      'explain',
      'rule',
    ]);
  });
});
