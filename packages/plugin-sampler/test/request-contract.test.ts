import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { compileHook } from './compile-probe.js';
import { type SamplerHarness, startSampler } from './plugin-harness.js';

/**
 * #47: `utils.request` initiates a Transaction and cannot promise its outcome,
 * and the types say so — a union of every declared response, an
 * `UndeclaredResponseError` for anything else, and arguments that overlay the
 * generated request rather than replacing it.
 */
const CREATE = 'POST /launches (application/json) -> 201 (application/json)';
const CREATE_400 =
  'POST /launches (application/json) -> 400 (application/json)';
const GET_LAUNCH = 'GET /launches/{id} -> 200 (application/json)';

/** One operation with three declared responses, plus one to hook onto. */
const FIXTURE = (() => {
  const format = new ThymianFormat();

  const created = createHttpRequest({
    method: 'POST',
    path: '/launches',
    mediaType: 'application/json',
    body: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        crew: { type: 'array', items: { type: 'string' } },
      },
    } as never,
    bodyRequired: true,
  });

  format.addHttpTransaction(
    created,
    createHttpResponse({
      statusCode: 201,
      schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      } as never,
    }),
    'test-source',
  );
  format.addHttpTransaction(
    created,
    createHttpResponse({
      statusCode: 400,
      schema: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string' } },
      } as never,
    }),
    'test-source',
  );
  format.addHttpTransaction(
    created,
    createHttpResponse({ statusCode: 401, mediaType: '' }),
    'test-source',
  );
  format.addHttpTransaction(
    createHttpRequest({ method: 'GET', path: '/launches/{id}' }),
    createHttpResponse({ statusCode: 200 }),
    'test-source',
  );

  return format;
})();

const CATALOG = TransactionCatalog.fromThymianFormat(FIXTURE);

function transactionIdOf(selector: string): string {
  return CATALOG.resolve(selector).transactionId;
}

describe('the response of a cross-endpoint request', () => {
  it('narrows to the body of whichever declared status came back', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  const res = await utils.request(${JSON.stringify(CREATE)}, { body: { name: 'Artemis' } });

  if (res.statusCode === 201) {
    request.pathParameters['id'] = res.body.id;
  } else if (res.statusCode === 400) {
    utils.skip(res.body.error);
  }
});
`,
    );

    expect(diagnostics).toEqual([]);
  });

  it('does not offer the other statuses’ bodies inside a narrowed branch', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  const res = await utils.request(${JSON.stringify(CREATE)}, { body: { name: 'Artemis' } });

  if (res.statusCode === 400) {
    // \`error\` is the 400 body's own property, and typed.
    const declared: string = res.body.error;
    // \`id\` belongs to the 201 body. The schema leaves the object open, so it
    // is reachable — but as \`unknown\`, not as the string it is over there.
    const foreign: string = res.body.id;

    utils.skip(declared + foreign);
  }
});
`,
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toContain('const foreign: string');
    expect(diagnostics[0]?.message).toMatch(
      /'unknown' is not assignable to type 'string'/,
    );
  });

  it('leaves an undeclared status out of the union entirely', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  const res = await utils.request(${JSON.stringify(CREATE)}, { body: { name: 'Artemis' } });

  if (res.statusCode === 418) {
    utils.skip('teapot');
  }
});
`,
    );

    // A comparison against a status no member carries is unsatisfiable, which
    // is exactly the report we want: the union is what the description
    // declares, and 418 is not in it.
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toContain('418');
    expect(diagnostics[0]?.message).toMatch(
      /comparison appears to be unintentional/,
    );
  });

  it('narrows the media type where one status declares one', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  const res = await utils.request(${JSON.stringify(CREATE)}, { body: { name: 'Artemis' } });

  if (res.statusCode === 401) {
    const media: '' = res.mediaType;
    utils.skip(media);
  }
});
`,
    );

    expect(diagnostics).toEqual([]);
  });

  it('compiles a hook that ignores the response entirely', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE)}, { body: { name: 'Artemis' } });
});
`,
    );

    expect(diagnostics).toEqual([]);
  });
});

describe('the arguments of a cross-endpoint request', () => {
  it('are optional, and accept a partial body', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE)});
  await utils.request(${JSON.stringify(CREATE)}, {});
  await utils.request(${JSON.stringify(CREATE)}, { body: { crew: ['Ada'] } });
  await utils.request(${JSON.stringify(CREATE)}, { path: {}, headers: { 'x-a': 'b' } });
});
`,
    );

    expect(diagnostics).toEqual([]);
  });

  it('still reject a body field of the wrong type', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE)}, { body: { name: 42 } });
});
`,
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toMatch(
      /'number' is not assignable to type 'string'/,
    );
  });
});

describe('a cross-endpoint request at run time', () => {
  const harnesses: SamplerHarness[] = [];

  async function sampler(): Promise<SamplerHarness> {
    const harness = await startSampler();
    harnesses.push(harness);

    return harness;
  }

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  /** The body the POST actually went out with. */
  function dispatchedBody(harness: SamplerHarness): unknown {
    const [first] = harness.dispatched;

    return JSON.parse(String(first?.request.body));
  }

  it('overlays the body: objects recurse, arrays replace, null overrides', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'seed.ts',
      `import { beforeEach, defineSample } from '@thymian/hooks';

export const base = defineSample(${JSON.stringify(CREATE)}, (draft) => {
  draft.body = {
    name: 'generated',
    nested: { kept: 1, replaced: 2 },
    crew: ['Ada', 'Grace'],
    nullable: 'was a string',
  };
});

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE)}, {
    body: { nested: { replaced: 9 }, crew: ['Katherine'], nullable: null },
  });
});
`,
    );

    harness.responses.push({ statusCode: 201 });

    await harness.loadFormat(FIXTURE);
    await harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE);

    expect(dispatchedBody(harness)).toEqual({
      // Untouched by the overlay, so it comes from the generated sample.
      name: 'generated',
      // Recursed into: one key replaced, its sibling kept.
      nested: { kept: 1, replaced: 9 },
      // Replaced whole rather than concatenated.
      crew: ['Katherine'],
      // `null` is a value, not an absence.
      nullable: null,
    });
  });

  it('replaces the body when the overlay is not an object', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'seed.ts',
      `import { beforeEach, defineSample } from '@thymian/hooks';

export const base = defineSample(${JSON.stringify(CREATE)}, (draft) => {
  draft.body = { name: 'generated' };
});

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE)}, { body: 'raw' });
});
`,
    );

    harness.responses.push({ statusCode: 201 });

    await harness.loadFormat(FIXTURE);
    await harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE);

    expect(harness.dispatched[0]?.request.body).toBe('raw');
  });

  it('merges parameter groups per key', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'seed.ts',
      `import { beforeEach, defineSample } from '@thymian/hooks';

export const base = defineSample(${JSON.stringify(CREATE)}, (draft) => {
  draft.headers['x-kept'] = 'from-sample';
  draft.headers['x-overlaid'] = 'from-sample';
});

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE)}, {
    headers: { 'x-overlaid': 'from-caller' },
  });
});
`,
    );

    harness.responses.push({ statusCode: 201 });

    await harness.loadFormat(FIXTURE);
    await harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE);

    expect(harness.dispatched[0]?.request.headers).toMatchObject({
      'x-kept': 'from-sample',
      'x-overlaid': 'from-caller',
    });
  });

  it('answers a declared-but-different status truthfully', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'seed.ts',
      `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  const res = await utils.request(${JSON.stringify(CREATE)}, { body: { name: 'Artemis' } });

  request.headers['x-seed-status'] = String(res.statusCode);
  request.headers['x-seed-media'] = res.mediaType;
  request.headers['x-seed-error'] = String((res.body as { error?: string }).error);
});
`,
    );

    // The seed asked for 201 and the server answered 400 — which the
    // description declares, so it is a member of the union and comes back.
    harness.responses.push({
      statusCode: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'no name' }),
    });

    await harness.loadFormat(FIXTURE);

    const { result } = await harness.beforeRequest(
      transactionIdOf(GET_LAUNCH),
      FIXTURE,
    );

    expect(result.headers['x-seed-status']).toBe('400');
    // The media type is the essence the response actually carried.
    expect(result.headers['x-seed-media']).toBe('application/json');
    expect(result.headers['x-seed-error']).toBe('no name');
  });

  it('throws UndeclaredResponseError for a status nothing declares', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'seed.ts',
      `import { beforeEach, UndeclaredResponseError } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  try {
    await utils.request(${JSON.stringify(CREATE)}, { body: { name: 'Artemis' } });
  } catch (e) {
    if (!(e instanceof UndeclaredResponseError)) {
      throw e;
    }

    request.headers['x-selector'] = e.selector;
    request.headers['x-status'] = String(e.statusCode);
    request.headers['x-content-type'] = String(e.headers['content-type']);
    request.headers['x-body'] = String((e.body as { message?: string }).message);
  }
});
`,
    );

    harness.responses.push({
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'FOREIGN KEY constraint failed' }),
    });

    await harness.loadFormat(FIXTURE);

    const { result } = await harness.beforeRequest(
      transactionIdOf(GET_LAUNCH),
      FIXTURE,
    );

    expect(result.headers).toMatchObject({
      'x-selector': CREATE,
      'x-status': '500',
      'x-content-type': 'application/json',
      // Parsed, not the raw string.
      'x-body': 'FOREIGN KEY constraint failed',
    });
  });

  it('accepts a status another response of the same operation declares', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'seed.ts',
      `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  // Seeding through the 400 selector, answered with the 201 its sibling
  // declares: still a declared response of the same operation.
  const res = await utils.request(${JSON.stringify(CREATE_400)}, { body: { name: 'Artemis' } });

  request.headers['x-seed-status'] = String(res.statusCode);
});
`,
    );

    harness.responses.push({
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'l-1' }),
    });

    await harness.loadFormat(FIXTURE);

    const { result } = await harness.beforeRequest(
      transactionIdOf(GET_LAUNCH),
      FIXTURE,
    );

    expect(result.headers['x-seed-status']).toBe('201');
  });
});
