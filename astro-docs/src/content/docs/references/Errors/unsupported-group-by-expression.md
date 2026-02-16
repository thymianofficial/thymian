---
title: 'UnsupportedGroupByExpression'
---

## The Cause

The group by expression you're using is not supported for grouping common HTTP transactions. Certain expressions that depend on dynamic runtime behavior cannot be used for grouping transactions.

Unsupported expressions include:

- `hasResponse` - Whether a request has a response
- `hasBody` - Whether a request/response has a body
- `hasResponseBody` - Whether a response has a body
- `statusCodeRange` - Status code ranges
- `responseTrailer` - Response trailer headers

## The Solution

Use only supported grouping expressions that don't depend on runtime behavior.
