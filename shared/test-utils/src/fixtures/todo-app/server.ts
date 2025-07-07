import { buildTodosApp } from './app.js';

const app = buildTodosApp({
  logger: {
    level: 'trace',
  },
});

await app.listen({ port: 8080 });
