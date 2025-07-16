import { buildExampleApp } from './app.js';

const app = buildExampleApp({
  logger: {
    level: 'error',
  },
  ignoreTrailingSlash: true,
});

await app.listen({ port: 8080 });
