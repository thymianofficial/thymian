import {
  and,
  method,
  not,
  or,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-should-send-validator-fields')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-200-ok')
  .description(
    `In 200 responses to GET or HEAD, an origin server SHOULD send any available validator fields for 
    the selected representation, with both a strong entity tag and a Last-Modified date being preferred.`,
  )
  .summary(
    'Origin servers SHOULD send Etag or Last-Modified header in a 200 (OK) responses to GET or HEAD requests.',
  )
  .explanation(
    'When your origin server answers a GET or HEAD request with 200 (OK), it should attach validator fields for the returned representation, ideally both a strong ETag and a Last-Modified date. This matters because those validators are what let clients and caches make efficient conditional requests later: with a validator on hand, a client can ask "has this changed?" and receive a lightweight 304 (Not Modified) instead of the full body, saving bandwidth and speeding things up. Without them, every revalidation forces a complete re-download.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(or(method('get'), method('head')), statusCode(200)),
      not(or(responseHeader('etag'), responseHeader('last-modified'))),
    ),
  )
  .done();
