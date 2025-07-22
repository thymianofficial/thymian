# @thymian/http-testing

`@thymian/http-testing` is a HTTP testing library which proposes a new testing approach. Instead of writing tests
for each of your HTTP-based APIs, define them once and run it against all your APIs.

## The fundamental concept of API-unspecific tests

If you normally write End-to-end (E2E) tests for your HTTP API, it looks something like this:

```js
const request = require('supertest');
const express = require('express');

const app = express();

app.get('/user', function(req, res) {
  res.status(200).header('Cache-Control', 'private, max-age=42').json({ name: 'alan turing' });
});

request(app)
  .get('/user')
  .expect(200)
  .then(response => {
    expect(response.headers['Cache-Control']).toBeDefined();
  })

```

While this is the common approach to write tests, it does not scale well. Imagine a situation in which you are responsible 
for multiple services and each of these services has an arbitrary number of GET endpoints for which you want to test 
that the Cache-Control header is set. With the approach above you would have to write a lot of tests.

🛟 __@thymian/http-testing to the rescue__ 🛟

`@thymian/http-testing` is working on an abstraction layer above of concrete tests. Instead working with specific HTTP
APIs, it lets you define tests based on the `Thymian format` (which can be found in @thymian/core). And since every API
description could be transformed into the Thymian format, the defined tests are detached from any specific API. Let's
see this in action.

```js
httpTest('every GET response should contain a Cache-Control header', transactions =>
  transactions.pipe(
    filter(req => req.method === 'GET'),
    mapToTestCase(),
    generateRequest(),
    runRequests(),
    expectStatusCode(200),
    expectHeaders(headers => {
      assert.ok(headers['Cache-Control'])
    })
  ),
)
```

As you can see the test definition does not include any path oder API specific information.

## How does this work?

To say it in the most complicated way: With `@thymian/http-testing` you won't define your tests imperatively but 
declaratively. You don't describe __how__ to call and test an HTTP but __what__ to call and test. This is modeled 
through the usage of [RsJS](https://rxjs.dev/). While this library is mainly used to implement the asynchronous event 
processing, especially in frontend projects (think about mouse click events), we use the capabilities of RxJS to
implement a declarative testing approach. RxJS provides a way to write code in a declarative, functional and pure
way. We use its powerful collection of operators to implement our approach as a pipeline. Thereby the initial value of
the pipeline is always the list of available HTTP transaction given through the corresponding API description. While
you are totally free to do whatever you want in this pipeline, the result of it must be a collection of passed, skipped
or failed test cases. To define and run these test cases `@thymian/http-testing` provides a number of operators
additional to the built-in ones from RxJS itself. 

    +-------------------+     +------+             +------+     +------------+
    | HTTP Transactions | --> | Step | --> ... --> | Step | --> | Test Cases |
    +-------------------+     +------+             +------+     +------------+

To align with the approach of RxJS, the list of HTTP transactions is an [Observable](https://rxjs.dev/guide/observable).

