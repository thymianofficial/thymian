import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { ThymianEmitter } from '../src/emitter/thymian-emitter.js';
import { ThymianFormat } from '../src/format/index.js';
import type { HttpRequest, HttpRequestTemplate } from '../src/http.js';
import { createContextFromEmitter } from '../src/http-testing/http-test/create-http-test-context.js';
import { NoopLogger } from '../src/logger/noop.logger.js';

const DESCRIBED = 'https://api.example.test';
const OVERRIDE = 'http://localhost:9';

function emitterWithSampler(): {
  emitter: ThymianEmitter;
  dispatched: HttpRequest[];
} {
  const emitter = new ThymianEmitter(new NoopLogger(), {
    completed: new Set(),
    errors: new Subject(),
    events: new Subject(),
    listeners: new Map(),
    responses: new Subject(),
    source: '@thymian/core',
  });
  const dispatched: HttpRequest[] = [];

  emitter.onAction('core.request.sample', (_payload, ctx) => {
    ctx.reply({
      origin: DESCRIBED,
      path: '/launches',
      pathParameters: {},
      method: 'GET',
      query: {},
      authorize: false,
      headers: {},
      cookies: {},
    });
  });
  emitter.onAction('core.request.dispatch', ({ request }, ctx) => {
    dispatched.push(request);
    ctx.reply({ statusCode: 200, headers: {}, trailers: {}, duration: 0 });
  });

  return { emitter, dispatched };
}

function oneTransaction() {
  const format = new ThymianFormat();

  format.addHttpTransaction(
    {
      type: 'http-request',
      host: 'api.example.test',
      port: 443,
      protocol: 'https',
      path: '/launches',
      method: 'GET',
      headers: {},
      queryParameters: {},
      cookies: {},
      pathParameters: {},
      mediaType: '',
    },
    {
      type: 'http-response',
      statusCode: 200,
      headers: {},
      mediaType: 'application/json',
    },
    'test-source',
  );

  const [transaction] = format.getThymianHttpTransactions();

  if (!transaction) {
    throw new Error('the format has no transaction');
  }

  return { format, transaction };
}

/**
 * `--target-url` used to be applied at dispatch only, so the template hooks
 * are handed — and a `utils.request` seed inherits its origin from — still
 * named the described server: the run talked to the override while every
 * seed went elsewhere. The sampler covers this from its own seam; this pins
 * the core contract the sampler relies on.
 */
describe('createContextFromEmitter with a target-url override', () => {
  it('puts the override on the sampled request template', async () => {
    const { emitter } = emitterWithSampler();
    const { format, transaction } = oneTransaction();
    const context = createContextFromEmitter(
      format,
      new NoopLogger(),
      emitter,
      OVERRIDE,
    );

    const template = await context.sampleRequest(transaction);

    expect(template.origin).toBe(OVERRIDE);
    expect(template.path).toBe('/launches');
  });

  it('leaves the described origin on the template when there is no override', async () => {
    const { emitter } = emitterWithSampler();
    const { format, transaction } = oneTransaction();
    const context = createContextFromEmitter(format, new NoopLogger(), emitter);

    const template = await context.sampleRequest(transaction);

    expect(template.origin).toBe(DESCRIBED);
  });

  it('still applies the override at dispatch, for a request built some other way', async () => {
    const { emitter, dispatched } = emitterWithSampler();
    const { format } = oneTransaction();
    const context = createContextFromEmitter(
      format,
      new NoopLogger(),
      emitter,
      OVERRIDE,
    );

    await context.runRequest({
      origin: DESCRIBED,
      path: '/launches',
      method: 'GET',
    });

    expect(dispatched.map((request) => request.origin)).toEqual([OVERRIDE]);
  });
});
