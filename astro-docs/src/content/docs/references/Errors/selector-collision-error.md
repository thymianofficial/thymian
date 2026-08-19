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

Listing the same description twice is _not_ a cause: identical operations are merged before the catalog is built, so they arrive as one transaction, not two.

## The Solution

To resolve this:

1. Read the two lines in the error's suggestions. They name each colliding transaction's source, its origin, and — when the description carries position information — the file and line it came from. When both lines name the same source, the collision is inside one description; the file positions, where the description carries them, are what tells the two apart.

2. If the two transactions come from **different** sources, load them separately, in separate runs or separate configurations. There is no source-discriminator syntax in a selector, by design.

3. If they come from the **same** source, give them selectors that differ. Remove the base path that one of them duplicates, or make the operations differ in method, path, status code or media type — a difference that lives only in a query parameter or a header is invisible to a selector.
