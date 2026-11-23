# ADR-0029: Capture Gaps are marked on the captured message; rules ask per field

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-11-16 | —          | —             |

## Context

A `Capture Gap` (workspace glossary) is a part of a message exchange the tap did not record,
so its absence must not be read as absence. The analyzer could not keep that distinction for
headers. `SqliteHttpTransactionRepository` writes no header rows when `headers` is
`undefined`, and reads a message with no rows back as `{}`. So a hop recorded without headers
looked exactly like a message that carried none, and trace rules that compare a field across
a forwarding participant reported it as added or removed by the proxy.

thymianofficial/thymian-workspace#683 worked around this in one rule (`proxy-must-forward-unrecognized-header-fields`) with a
heuristic: a hop with no header field at all counts as not captured. That is not a
distinction, only a guess. It also skips a hop that was captured and really carried no field.
Six more trace rules in `rules-rfc-9110` had no guard at all.

Thymian has already decided where gaps belong. _How does tapped traffic reach Thymian?_
(thymianofficial/thymian-workspace#590) put Capture Gap markers in the core transaction
model, not only in the input format. The Envoy receiver (thymianofficial/thymian-workspace#611)
names four kinds: body not captured, body truncated, header set filtered, value masked. None
of them existed yet. This decision builds the first one, and builds it so the others extend
it rather than replace it.

The options were:

- **A rule-side heuristic** shared by all trace rules. No model change, but it cannot tell a
  captured message with no headers from an unrecorded one.
- **`headers: undefined` means not captured**, end to end. The compiler would force rules to
  handle it, but `HttpResponse.headers` is required and shared with live `test` traffic, so
  every rule and the test path would change. It also cannot express a partly filtered header
  set, so thymianofficial/thymian-workspace#611 would need a second mechanism.
- **A marker on the captured message's `meta`**, the envelope only recorded traffic has.

## Decision

We will mark Capture Gaps on the captured message, not in its data.

- **Shape.** `CapturedHttpRequest.meta` and `CapturedHttpResponse.meta` carry an optional
  `captureGaps?: CaptureGap[]`. `CaptureGap` is a closed union of variants tagged by `kind`.
  Today it has one member, `{ kind: 'headers-not-captured' }`. A further kind is added by
  widening the union, the same discipline as `Rule Tag` and `Impossibility Reason`. The
  shapes of the other three kinds, including what a _header set filtered_ gap records about
  the dropped names, are left to the Envoy receiver work
  (thymianofficial/thymian-workspace#611). `HttpRequest` and
  `HttpResponse` are unchanged, and `data.headers` stays an object.
- **Rule contract.** Rules ask `isHeaderCaptured(message, name)`, or
  `isHeaderCapturedOnBoth(a, b, name)` for a field compared across two messages; both live
  in core next to `getHeader`. They never read `meta.captureGaps` themselves. The question is per field
  name, so when a filtered header set arrives, the answer changes per name without editing
  any rule.
- **The marker wins.** A message marked `headers-not-captured` answers `false` for every
  name, whatever headers it also carries. The repository stores the headers as given and
  does not reconcile the two.
- **Storage.** The analyzer stores gaps in `request_capture_gap` and
  `response_capture_gap`, mirroring `http_request_header` and `http_response_header`: a
  foreign key to the message, a `kind` and a JSON `detail`, created `IF NOT EXISTS`. Tables
  rather than columns, because the analyzer can persist its
  database to a file across runs. `init.sql` only creates what is missing, so a new column
  would never reach an existing file, while a new table does. Rows written before this
  change read back with no gap, which is correct. Later kinds need no schema change.
- **Rule behaviour.** A trace rule skips a pair silently when a field it reads was not
  captured on a message it reads it from. It reports neither a violation nor a finding for that pair.
  thymianofficial/thymian-workspace#683's heuristic is removed, and that rule uses the helper like the others.

## Consequences

**Positive:**

- A rule can tell a hop recorded without headers from one that carried none, through the
  real analyzer.
- The trace rules that read a field on either side of a proxy
  (`proxy-must-not-modify-authorization`, `-www-authenticate`, `-authentication-info`,
  `proxy-should-not-modify-endpoint-and-representation-headers`,
  `intermediary-must-generate-updated-max-forwards-when-forwarding`,
  `proxy-must-not-generate-new-max-forwards-header`,
  `proxy-must-forward-unrecognized-header-fields`,
  `proxy-may-transform-content-without-no-transform-directive`) no longer report a finding
  that rests only on a gap.
- The other three kinds the Envoy receiver names have a place to go that rules already
  consult (thymianofficial/thymian-workspace#611).

**Negative:**

- The compiler does not force a rule to ask. A rule that reads `data.headers` without
  `isHeaderCaptured` still reads a gap as absence. The guard is a convention, held by review,
  by this record, by the `add-http-rule-set` skill and by arc42 §8.4.3.
- The marker covers only trace rules. SQL header filters (`requestHeader`, `responseHeader`,
  `not(...)`) and single-transaction rules do not consult it. A rule like "a 3xx must carry
  `Location`" would still flag a message whose headers were not captured. No traffic source
  produces a gap on a single transaction today. Teaching the filter engine about gaps is left
  to the Envoy receiver work (thymianofficial/thymian-workspace#611), because a filtered
  header set needs it anyway.
- A skipped pair leaves no trace in the report. Whether a report should say a pair was
  skipped, and how, for every kind, is left to the Envoy receiver work
  (thymianofficial/thymian-workspace#611).

**Neutral:**

- The HAR plugin raises no gaps. HAR 1.2 requires `headers`, so `[]` stays `{}`: captured,
  with no fields. Reading gaps from stretched HAR's `_` fields is left to the Envoy receiver
  work (thymianofficial/thymian-workspace#611).
- Trace rules that only stay silent when a field is missing
  (`intermediary-must-check-and-update-max-forwards`,
  `intermediary-should-remove-known-hop-by-hop-fields`,
  `intermediary-must-parse-and-remove-connection-fields`,
  `proxy-must-not-change-field-line-order`) can miss a violation on a gap but never invent
  one. They carry a note saying so, not a guard.
- Trailers and bodies are out of scope. Trailers wait until a tap delivers them
  (thymianofficial/thymian-workspace#590). Body not captured and body truncated are defined
  with the other kinds in the Envoy receiver work (thymianofficial/thymian-workspace#611).

## Related

- [ADR-0014](0014-rule-results-carry-violations-and-findings.md): what a rule result may carry
  (a skipped pair carries nothing).
- thymianofficial/thymian-workspace#718: the ticket this decides.
- thymianofficial/thymian-workspace#683: the per-rule heuristic this replaces.
- thymianofficial/thymian-workspace#590: gaps belong in the core model.
- thymianofficial/thymian-workspace#611: the remaining gap kinds, filter support and gap
  reporting.

---

## Status History

| Date       | Status   | Notes                                                                 |
| ---------- | -------- | --------------------------------------------------------------------- |
| 2026-11-16 | Accepted | Decided in the thymianofficial/thymian-workspace#718 grilling session |
