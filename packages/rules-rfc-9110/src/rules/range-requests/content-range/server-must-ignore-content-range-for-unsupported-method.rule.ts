import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-must-ignore-content-range-for-unsupported-method',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'The server must ignore a Content-Range received in a request whose method has no defined Content-Range support. Ignoring is internal — the request is processed as if the field were absent — and produces no distinguishing wire signal.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'A server MUST ignore a Content-Range header field received in a request with a method for which Content-Range support is not defined.',
  )
  .summary(
    'Server must ignore a Content-Range request header for methods with no defined Content-Range support.',
  )
  .appliesTo('server')
  .done();
