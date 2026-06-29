import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-exclude-referer-or-send-about-blank-for-no-source',
)
  .severity('hint')
  // Informational (#327): conformance is conditioned on the *origin* of the
  // target URI (typed by hand, chosen from bookmarks, …) — knowledge held only
  // by the user agent. That source is not present in the request, so the
  // triggering condition cannot be observed and there is no detectable
  // non-conformant case. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'If the target URI was obtained from a source that does not have its own URI (e.g., input from the user keyboard, or an entry within the user\'s bookmarks/favorites), the user agent MUST either exclude the Referer header field or send it with a value of "about:blank".',
  )
  .appliesTo('user-agent')
  .done();
