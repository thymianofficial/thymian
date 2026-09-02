---
title: 'MalformedSelectorError'
---

## The Cause

A value was used where a
[Selector](/references/plugins/sampler/hooks-api/#selectors) was expected, but it
is not one.

The grammar is:

```
METHOD SP path [ SP "(" requestMediaType ")" ] SP "->" SP status [ SP "(" responseMediaType ")" ]
```

```
GET /launches -> 200 (application/json)
POST /astronauts (application/json) -> 201 (application/json)
DELETE /astronauts/{id} -> 204
```

## What to do

The error suggests a canonical spelling when the value is _nearly_ a Selector —
a lowercase method, a missing leading `/`, or a zero-padded status:

```
A selector spells its method in uppercase, spells its path with a leading "/"
and spells its status without leading zeros.
Did you mean "GET /launches -> 200"?
```

The most common genuine mistake is omitting the `-> status` part entirely: a
Selector always names a status, because a status is part of what identifies a
Transaction.

Note the media part appears whenever the description **declares** a media type —
not only when there is a body.
