# ADR-0026: Capture Gaps are marked on the captured message, and rules ask a per-field helper

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
  widening the union, the same discipline as `Rule Tag` and `Impossibility Reason`. thymianofficial/thymian-workspace#611
  decides the shape of its kinds, including _header set filtered_. `HttpRequest` and
  `HttpResponse` are unchanged, and `data.headers` stays an object.
- **Rule contract.** Rules ask `isHeaderCaptured(message, name)`, which lives in core next
  to `getHeader`. They never read `meta.captureGaps` themselves. The question is per field
  name, so when a filtered header set arrives, the answer changes per name without editing
  any rule.
- **The marker wins.** A message marked `headers-not-captured` answers `false` for every
  name, whatever headers it also carries. The repository stores the headers as given and
  does not reconcile the two.
- **Storage.** The analyzer stores gaps in a separate `capture_gap` table with
  `message_kind` (request or response), `message_id`, `kind` and a JSON `detail`, created
  `IF NOT EXISTS`. A table rather than a column, because the analyzer can persist its
  database to a file across runs. `init.sql` only creates what is missing, so a new column
  would never reach an existing file, while a new table does. Rows written before this
  change read back with no gap, which is correct. Later kinds need no schema change.
- **Rule behaviour.** A trace rule skips a pair silently when a field it compares was not
  captured on either side. It reports neither a violation nor a finding for that pair.
  thymianofficial/thymian-workspace#683's heuristic is removed, and that rule uses the helper like the others.

## Consequences

**Positive:**

- A rule can tell a hop recorded without headers from one that carried none, through the
  real analyzer.
- The trace rules that compare a field across a proxy (`proxy-must-not-modify-authorization`,
  `-www-authenticate`, `-authentication-info`,
  `proxy-should-not-modify-endpoint-and-representation-headers`,
  `intermediary-must-generate-updated-max-forwards-when-forwarding`,
  `proxy-must-not-generate-new-max-forwards-header`,
  `proxy-must-forward-unrecognized-header-fields`) no longer report a finding that rests only
  on a gap.
- thymianofficial/thymian-workspace#611's kinds have a place to go that rules already consult.

**Negative:**

- The compiler does not force a rule to ask. A rule that reads `data.headers` without
  `isHeaderCaptured` still reads a gap as absence. The guard is a convention, held by review
  and by this record.
- The marker covers only trace rules. SQL header filters (`requestHeader`, `responseHeader`,
  `not(...)`) and single-transaction rules do not consult it. A rule like "a 3xx must carry
  `Location`" would still flag a message whose headers were not captured. No traffic source
  produces a gap on a single transaction today. thymianofficial/thymian-workspace#611 must teach the filter engine about gaps,
  because a filtered header set needs it anyway.
- A skipped pair leaves no trace in the report. Whether and how gaps are reported, for every
  kind, is thymianofficial/thymian-workspace#611's question.

**Neutral:**

- The HAR plugin raises no gaps. HAR 1.2 requires `headers`, so `[]` stays `{}`: captured,
  with no fields. Stretched HAR's `_` fields belong to thymianofficial/thymian-workspace#611.
- Trace rules that only stay silent when a field is missing
  (`intermediary-must-check-and-update-max-forwards`,
  `intermediary-should-remove-known-hop-by-hop-fields`,
  `intermediary-must-parse-and-remove-connection-fields`) can miss a violation on a gap but
  never invent one. They carry a note saying so, not a guard.
- Trailers and bodies are out of scope. Trailers wait until a tap delivers them (thymianofficial/thymian-workspace#590). The
  body kinds are thymianofficial/thymian-workspace#611's.

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
