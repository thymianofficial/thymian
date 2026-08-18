---
title: 'MalformedSelectorError'
---

## The Cause

The value is not a transaction selector. A selector is written as:

```
METHOD SP path [ SP "(" requestMediaType ")" ] SP "->" SP status [ SP "(" responseMediaType ")" ]
```

```
GET /launches -> 200 (application/json)
POST /astronauts (application/json) -> 201 (application/json)
DELETE /astronauts/{id} -> 204
```

The grammar is strict, because a selector is an identity key rather than a description. This typically happens when:

- The method is lowercase. The canonical form is uppercase: `GET`, not `get`.
- The arrow is not an ASCII `->` surrounded by exactly one space on each side, or the separators are padded with extra spaces.
- The status code is missing entirely.
- A parenthesis around a media type is unbalanced.
- The value is Thymian's _display_ string — `GET /launches - application/json → 200 OK - application/json` — which uses a Unicode arrow, a `-` media separator and a reason phrase. It is a near-twin of a selector, and it is not one.

The same error is raised when a transaction cannot be rendered as a selector at all: a request path that carries whitespace or `->`, or a media type that carries a parenthesis, would produce a string that could not be read back.

## The Solution

To resolve this:

1. Rewrite the value to match the grammar above. The error's suggestions include a worked example, and — when only the method case is wrong — the corrected selector.

2. Do not use the display string from reports, rule headings or test-case names as a selector. Take the selector from the API description instead.

3. If the error names a request path or media type, the API description or captured traffic carries a value a selector cannot represent. Fix it at the source.
