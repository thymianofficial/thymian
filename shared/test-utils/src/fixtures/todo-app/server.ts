import { buildTodosApp } from './app.js';

const app = buildTodosApp({ logger: true });

await app.listen({ port: 8080 });
