/**
 * Fixture plugin that returns static traffic data for e2e analyze tests.
 *
 * This plugin handles the `core.traffic.load` action and replies with
 * pre-built HTTP transactions — some that will pass RFC 9110 rules and
 * some that will trigger violations (missing validator fields like ETag).
 */
export default {
  name: '@thymian/e2e-traffic-loader',
  version: '0.x',
  plugin: async (emitter) => {
    emitter.onAction('core.traffic.load', (_input, ctx) => {
      ctx.reply({
        transactions: [
          // Transaction 1: GET 200 WITHOUT ETag/Last-Modified → triggers
          // rfc9110/server-should-send-validator-fields violation
          {
            request: {
              data: {
                method: 'get',
                origin: 'https://api.example.com',
                path: '/users/1',
                headers: {},
              },
              meta: {},
            },
            response: {
              data: {
                statusCode: 200,
                headers: { 'content-type': 'application/json' },
                trailers: {},
                duration: 42,
              },
              meta: { role: 'origin server' },
            },
          },
          // Transaction 2: GET 200 WITH ETag → passes validator-fields rule
          {
            request: {
              data: {
                method: 'get',
                origin: 'https://api.example.com',
                path: '/users/2',
                headers: {},
              },
              meta: {},
            },
            response: {
              data: {
                statusCode: 200,
                headers: {
                  'content-type': 'application/json',
                  etag: '"abc123"',
                },
                trailers: {},
                duration: 38,
              },
              meta: { role: 'origin server' },
            },
          },
          // Transaction 3: POST 201 → not matched by GET/HEAD-only rules
          {
            request: {
              data: {
                method: 'post',
                origin: 'https://api.example.com',
                path: '/users',
                headers: { 'content-type': 'application/json' },
                body: '{"name":"test"}',
              },
              meta: {},
            },
            response: {
              data: {
                statusCode: 201,
                headers: {
                  'content-type': 'application/json',
                  location: '/users/3',
                },
                trailers: {},
                duration: 55,
              },
              meta: { role: 'origin server' },
            },
          },
        ],
      });
    });
  },
};
