---
title: 'UnknownSelectorError'
---

## The Cause

The selector you used is well-formed, but no transaction in the loaded API description matches it.

A selector is fully qualified — method, path, request media type, status code and response media type all take part in the match:

```
POST /astronauts (application/json) -> 201 (application/json)
```

So a selector stops resolving as soon as any one of those parts changes. This typically happens when:

- The operation, the status code or the media type was renamed or removed from the API description.
- The path is spelled differently than the description spells it — a missing server basePath, a dropped `{param}` brace, a trailing slash.
- The status code or media type in the selector was never described for that operation.

Thymian does not rebind a selector to a "close enough" transaction. An anchor that no longer resolves fails the run instead of silently pointing somewhere else.

## The Solution

To resolve this:

1. Check the error's suggestions. When a transaction with the same path is loaded, Thymian lists up to five near-miss selectors — usually the one you meant, with a different status code or media type.

2. Compare the selector against the API description. The path is written exactly as the description writes it, including any server basePath and the `{param}` braces.

3. If the transaction was removed on purpose, update or delete whatever anchors that selector.
