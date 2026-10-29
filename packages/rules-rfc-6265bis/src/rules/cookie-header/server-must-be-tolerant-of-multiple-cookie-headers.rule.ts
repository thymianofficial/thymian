import { httpRule } from '@thymian/core';

// Informational: no context can check it. Only `test` could, by sending one
// request with its cookies split over two Cookie field lines and comparing
// the answer with that to the unsplit request, and a test request cannot
// carry a field twice yet. `static` cannot either, because an API
// description declares a request's headers as a map keyed by name, and
// neither can `analytics`, because recorded traffic with a split Cookie
// field does not say what the answer to the unsplit one would have been.
export default httpRule(
  'rfc-6265bis/server-must-be-tolerant-of-multiple-cookie-headers',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#502',
    'Checking this needs a test request that carries its cookies in two Cookie header fields, and the answer compared with the one to the same cookies in one field. Thymian cannot yet send a request with a repeated header field. An API description cannot declare a request with two Cookie field lines either, and recorded traffic with a split Cookie field cannot say how the server would have answered the unsplit one.',
  )
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.2.1',
  )
  .description(
    'Servers MUST be tolerant of multiple cookie headers. For example, an HTTP/2 [RFC9113] or HTTP/3 [RFC9114] client or intermediary might split a cookie header to improve compression. Servers are free to determine what form this tolerance takes. For example, the server could process each cookie header individually or the server could concatenate all the cookie headers into one and then process that final, single, header. The server should be mindful of any header field limits when deciding which approach to take.',
  )
  .summary(
    'Server must accept cookies split over several Cookie header fields.',
  )
  .explanation(
    'HTTP/2 and HTTP/3 clients and intermediaries may split the Cookie header into one field per cookie, because each field then compresses on its own. A server that reads only the first Cookie field, or rejects a request with two, loses every cookie in the others: a user who is logged in appears logged out, but only over HTTP/2 or HTTP/3, or only behind some proxy. Process every Cookie field, either one by one or joined with "; " into one.',
  )
  .appliesTo('server')
  .done();
