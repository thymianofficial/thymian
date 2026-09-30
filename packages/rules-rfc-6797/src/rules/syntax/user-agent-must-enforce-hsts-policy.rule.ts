import { httpRule } from '@thymian/core';

// The one rule in the package addressed to the user agent: 6.1/1 is the
// obligation the mechanism rests on, and it binds a peer whose state Thymian
// cannot see.
export default httpRule('rfc-6797/user-agent-must-enforce-hsts-policy')
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    'Enforcing the policy means the user agent rewrites http URIs for a Known HSTS Host to https before sending anything, and refuses to continue past a secure-transport error. Whether a host is a Known HSTS Host is state the user agent stores itself — noted from an earlier response, possibly expired or deleted since — so no message Thymian sees, sends or records says whether a user agent should have enforced the policy. Not even as a heuristic: recorded traffic does not say which user agent sent a request, so a plain-http request that follows a policy cannot be tied to one that received it.',
  )
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1')
  .description(
    'The Strict-Transport-Security HTTP response header field (STS header field) indicates to a UA that it MUST enforce the HSTS Policy in regards to the host emitting the response message containing this header field.',
  )
  .summary(
    'User agent must enforce the HSTS Policy of a host that sends the STS header field.',
  )
  .explanation(
    'This is the obligation the whole mechanism rests on: once a browser has seen a valid Strict-Transport-Security header, it must never again talk to that host over plain HTTP until the policy expires. The host cannot enforce this itself; everything this rule set checks on the host side exists to make sure the header the browser receives is one it will act on.',
  )
  .appliesTo('user-agent')
  .done();
