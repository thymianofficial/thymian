/**
 * Fixture plugin that returns clean (conformant) traffic for e2e analyze tests.
 *
 * All transactions include proper validator fields (ETag), so no RFC 9110
 * rules should trigger violations. Used to verify exit code 0 and the
 * happy-path message.
 */
export default {
  name: '@thymian/e2e-clean-traffic-loader',
  version: '0.x',
  plugin: async (emitter) => {
    emitter.onAction('core.traffic.load', (_input, ctx) => {
      ctx.reply({
        transactions: [
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
                headers: {
                  'content-type': 'application/json',
                  etag: '"abc123"',
                },
                trailers: {},
                duration: 30,
              },
              meta: { role: 'origin server' },
            },
          },
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
                  etag: '"def456"',
                },
                trailers: {},
                duration: 25,
              },
              meta: { role: 'origin server' },
            },
          },
        ],
      });
    });
  },
};
