import { describe, expect, it } from 'vitest';

import { overrideTemplate } from '../../src/http-testing/test-builder/override-request-template.js';
import {
  constant,
  type HttpRequestTemplate,
  method,
  queryParameter,
  requestHeader,
} from '../../src/index.js';

function emptyTemplate(): HttpRequestTemplate {
  return {
    origin: 'http://localhost:8080',
    path: '/users',
    pathParameters: {},
    method: 'GET',
    query: {},
    authorize: false,
    headers: {},
    cookies: {},
  };
}

describe('overrideTemplate', () => {
  it('unwraps constant() header values to their raw value', () => {
    const template = overrideTemplate(
      emptyTemplate(),
      requestHeader('if-none-match'),
      constant('"thymian-no-match"'),
    );

    expect(template.headers['if-none-match']).toBe('"thymian-no-match"');
  });

  it('sets raw string header values unchanged', () => {
    const template = overrideTemplate(
      emptyTemplate(),
      requestHeader('if-match'),
      '"qupaya"',
    );

    expect(template.headers['if-match']).toBe('"qupaya"');
  });

  it('unwraps constant() query parameter values', () => {
    const template = overrideTemplate(
      emptyTemplate(),
      queryParameter('page'),
      constant('2'),
    );

    expect(template.query['page']).toBe('2');
  });

  it('unwraps constant() method values', () => {
    const template = overrideTemplate(
      emptyTemplate(),
      method(),
      constant('get'),
    );

    expect(template.method).toBe('get');
  });

  it('keeps non-constant object values untouched', () => {
    const value = { nested: true };

    const template = overrideTemplate(
      emptyTemplate(),
      queryParameter('filter'),
      value,
    );

    expect(template.query['filter']).toBe(value);
  });
});
