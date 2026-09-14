import { httpRule } from '@thymian/core';

// This MUST describes byte-level tunnel-teardown behavior of a CONNECT
// intermediary (flushing outstanding data, closing both connections,
// discarding the remainder) at the TCP/stream layer. It is not expressed in
// any HTTP message, status, or header, so it is invisible to lint, test, and
// analyze alike. Flagged for the mis-declaration audit rather than given a
// tier-1 code here (thymianofficial/thymian-workspace#116): unlike the usual
// "internal decision with no trace" case, this may not be an HTTP-layer
// conformance statement at all.
// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/intermediary-must-attempt-to-send-outstanding-data-coming-from-closed-side-for-connect-request',
)
  .severity('error')
  .type('informational')
  // @ts-expect-error deliberately bare pending the mis-declaration audit (#116) — see the comment above; the corpus meta-test (impossibility.test.ts) asserts this is the sole exception
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A tunnel is closed when a tunnel intermediary detects that either side has closed its connection: the intermediary MUST attempt to send any outstanding data that came from the closed side to the other side, close both connections, and then discard any remaining data left undelivered.',
  )
  .appliesTo('intermediary')
  .done();
