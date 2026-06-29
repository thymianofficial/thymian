import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-ignore-content-range-for-unsupported-method',
)
  .severity('error')
  // Informational (outcome 2): the requirement is that the server *ignore* a
  // Content-Range received in a REQUEST whose method has no defined
  // Content-Range support. "Ignoring" is an internal behavior — the request is
  // processed as though the field were absent — and produces no distinguishing
  // signal on the wire. The previous rule matched a Content-Range on the
  // RESPONSE (responseHeader) of POST/DELETE/OPTIONS/GET, which is unrelated:
  // a response Content-Range (e.g. on a 206 GET) is legitimate and says nothing
  // about whether a request Content-Range was honored. With no observable
  // non-conformant condition, this is informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'A server MUST ignore a Content-Range header field received in a request with a method for which Content-Range support is not defined.',
  )
  .summary(
    'Server must ignore a Content-Range request header for methods with no defined Content-Range support.',
  )
  .appliesTo('origin server')
  .done();
