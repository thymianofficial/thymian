import { buildToDoApp } from './app.js';

const app = await buildToDoApp();

//console.log(JSON.stringify(app.swagger()));
await app.listen({ port: 3000 });
