---
title: 'SelectorCollisionError'
---

## The Cause

Two transactions in your loaded API descriptions render the same transaction selector, so a selector would no longer name exactly one transaction.

A selector is host-stripped — it is built from the method, the path, the request media type, the status code and the response media type, and from nothing else:

```
GET /users -> 200 (application/json)
```

Two sources that both describe `GET /users` returning `200 (application/json)` therefore collide, even though they are served from different origins. Thymian refuses to pick one: nothing is dropped, overwritten or resolved "last wins".

This typically happens when:

- Two API descriptions in `specifications` describe the same operation from different servers.
- The same description is listed twice under different source names.
- A staging and a production description of one API are loaded together.

## The Solution

To resolve this:

1. Read the two lines in the error's suggestions. They name each colliding transaction's source, its origin, and — when the description carries position information — the file and line it came from.

2. Load the colliding sources separately, in separate runs or separate configurations. There is no source-discriminator syntax in a selector, by design.

3. If the two descriptions are meant to be the same API, remove the duplicate entry from your `specifications` list.
