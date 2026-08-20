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

The same error is raised when a transaction in a loaded description cannot be _rendered_ as a selector at all, because the rendering would not read back as the same transaction. This aborts the load, and the error names the source and — where the description carries position information — the file and line of the transaction it could not render:

- The request path carries whitespace or `->`.
- A media type carries a parenthesis.
- The status is not a status code. This is the case you are most likely to hit, and it is almost never a status you typed: a non-numeric key in the OpenAPI Responses Object (`responses: { OK: … }`, or a specification extension such as `x-internal-note`) becomes `NaN`, and a key like `'200.5'` survives as a fraction. The rendering then reads `GET /pets -> NaN (application/json)`.
- The method is not an [RFC 9110 §5.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.2) token — a method with a space in it, for example.

In these cases the error's suggestions name the component at fault, and only that component.

## The Solution

To resolve this:

1. Rewrite the value to match the grammar above. The error's suggestions include a worked example, and a `Did you mean …?` correction when the value is a selector spelled non-canonically — a lowercase method, a path missing its leading slash, a zero-padded status, or any combination. The sentence in front of the correction states which of those it applied. There is no correction when the value is not recognizable as a selector, or when no canonical form of it exists: `GET /x -> 007` is not offered as `GET /x -> 7`, because `7` is not a status code either.

2. Do not use the display string from reports, rule headings or test-case names as a selector. Take the selector from the API description instead.

3. If the error names a request path or media type, the API description or captured traffic carries a value a selector cannot represent. Fix it at the source.

4. If the error names a status or a method, go to the file and line the error quotes and read the key it came from. A non-numeric or non-integer key in the Responses Object — including a specification extension placed there — is what produces a status a selector cannot carry; give the response its real three-digit status code, or move the extension out of the Responses Object.
