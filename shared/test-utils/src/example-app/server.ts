import { buildExampleApp } from './app.js';

const app = buildExampleApp({
  logger: {
    level: 'trace',
  },
  ignoreTrailingSlash: true,
});

await app.ready();

console.log(app.printRoutes());

await app.listen({ port: 8080 });
