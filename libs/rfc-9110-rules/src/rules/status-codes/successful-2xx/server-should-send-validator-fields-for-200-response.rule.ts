import { httpRule } from '@thymian/http-linter';

import { validatorFields } from '../../validator-fields.js';
import { forHttpTransactions } from '@thymian/http-testing';

export default httpRule('rfc9110/server-should-send-validator-fields')
  .severity('warn')
  .type('test', 'analytics')
  .appliesTo('origin server')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-200-ok')
  .description(
    `In 200 responses to GET or HEAD, an origin server SHOULD send any available validator fields for 
    the selected representation, with both a strong entity tag and a Last-Modified date being preferred.`
  )
  .summary(
    'Origin servers SHOULD send Etag or Last-Modified header in a 200 (OK) responses to GET or HEAD requests.'
  )
  .rule((ctx, options, logger) =>
    ctx.validateCommonHttpTransactions(
      (req, res) =>
        ctx.equalsIgnoreCase(req.method, 'get', 'head') &&
        res.statusCode === 200,
      (req, res) => !res.headers.some((header) => validatorFields.has(header))
    )
  )
  .done();
