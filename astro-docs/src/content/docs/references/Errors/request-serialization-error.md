---
title: 'RequestSerializationError'
---

## The Cause

The request could not be built from what the API description and your hooks
supplied. Something a request needs is missing or is not a value HTTP can carry:

- a path parameter with no value — `GET /launches/{id}` with nothing for `id`;
- a path or query parameter that is an object or an array where the
  serialization style expects a scalar;
- a header whose value is not a string;
- a body that cannot be turned into text.

This is not a defect: it is the API description not saying enough for one
Transaction to be executed as described.

## What to do

The message names the value, and nothing else — the Transaction it belongs to is
already printed above it wherever this appears:

```
↷ GET /launches/{id} -> 200 (application/json)
    Missing value for path parameter "id".
    Give it a value with an example in the API description, or set it from a hook.
```

Two ways to supply the value:

- **In the description.** Add an `example` to the parameter, which the sampler
  reflects into the generated request.
- **In a hook.** Set it where a real value comes from — usually a
  [seeding call](/guides/hooks/make-requests-in-hooks/) that creates the
  resource first:

  ```ts
  import { beforeEach } from '@thymian/hooks';

  export const seedLaunch = beforeEach('GET /launches/{id} -> 200 (application/json)', async (request, ctx, utils) => {
    const created = await utils.request('POST /launches (application/json) -> 201 (application/json)', { body: { name: 'Artemis' } });

    if (created.statusCode !== 201) {
      utils.skip('the launch to read could not be created');
    }

    request.pathParameters['id'] = created.body.id;
  });
  ```

In `thymian sampler check` a Transaction whose request cannot be built is
`skipped`, not failed: nothing was learned about the API, and the run continues
through every other Transaction.
