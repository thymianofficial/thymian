# Thymian

You want to try out Thymian? Run the following commands in the specific order:

* `npm i`
* `nx build cli`
* `npx tsx shared/test-utils/src/example-app/server.ts`
* `cd cli`
* `./bin/run.js run -o @thymian/openapi.filePath=../shared/test-utils/src/example-app/example-app.openapi.yaml -p test/fixtures/my-thymian-plugin.js`
