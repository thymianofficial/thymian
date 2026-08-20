---
title: 'SelectorCollisionError'
---

## The Cause

Two transactions in your loaded API descriptions render the same transaction selector, so a selector would no longer name exactly one transaction.

A selector is host-stripped — it is built from the method, the path, the request media type, the status code and the response media type, and from nothing else:

```
GET /users -> 200 (application/json)
```

Two descriptions that both expose `GET /users` returning `200 (application/json)` therefore collide, even though they are served from different origins. Thymian refuses to pick one: nothing is dropped, overwritten or resolved "last wins".

This happens across sources when:

- Two API descriptions in `specifications` describe the same operation from different servers.
- A staging and a production description of one API are loaded together.

It also happens **inside a single description**, because a selector carries neither the origin nor the query parameters, headers or body schema of an operation:

- One operation carries a server or operation-level `servers` entry whose base path re-adds a prefix that another operation already spells out, so `/v1/pets` and `/pets` collapse onto the same selector.
- Two operations share a method, path, status and media types and differ only in query parameters, headers, `description` or `bodyRequired`.

Listing the same description twice is a cause only when the two entries carry different options: a `serverInfo` override is taken per `specifications` entry, so one file listed twice under two different origins produces two transactions. Two listings with identical options are merged before the catalog is built and arrive as one.

Thymian does not tell you which of the two situations you are in, because it cannot: a source _name_ is not a source identity. `sourceName` defaults to the description's `info.title`, an explicit one is never required, and a description may carry an empty title or none at all — so two documents can print the same name. The error prints the evidence for both situations and names the remedy for each.

## The Solution

To resolve this:

1. Read the two lines in the error's suggestions. Each names a colliding transaction's source, its origin, and — when the description carries position information — the file and line it came from. Compare the **files**, not the names: two documents that share an `info.title` print the same name. A line quotes no file when the operation carries no `operationId`, which is what Thymian resolves a position from.

2. If the two lines point at **different** documents, load them separately, in separate runs or separate configurations. There is no source-discriminator syntax in a selector, by design.

3. If they point at **one** document, give the two operations selectors that differ. Remove the base path that one of them duplicates, or make them differ in method, path, status code or media type — a difference that lives only in a query parameter or a header is invisible to a selector.
