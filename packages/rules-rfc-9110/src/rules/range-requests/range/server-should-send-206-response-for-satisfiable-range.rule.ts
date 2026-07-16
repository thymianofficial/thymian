import {
  and,
  constant,
  getHeader,
  httpRule,
  method,
  not,
  requestHeader,
  responseHeader,
  type RuleFnResult,
  singleTestCase,
  statusCode,
} from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-send-206-response-for-satisfiable-range',
)
  .severity('warn')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'If all of the preconditions are true, the server supports the Range header field for the target resource, the received Range field-value contains a valid ranges-specifier with a range-unit supported for that target resource, and that ranges-specifier is satisfiable with respect to the selected representation, the server SHOULD send a 206 (Partial Content) response with content containing one or more partial representations that correspond to the satisfiable range-spec(s) requested.',
  )
  .summary(
    'Server should send 206 response when Range header conditions are met and range is satisfiable.',
  )
  .appliesTo('origin server')
  .rule(async (ctx) => {
    const results: RuleFnResult[] = [];
    await ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(and(method('GET'), statusCode(200)))
        .run()
        // Only meaningful when the server advertises range support at all. A
        // missing Accept-Ranges header means the server does not support range
        // requests, so answering the probe with 200 is conformant. ("Accept-
        // Ranges: none" is handled below, case-insensitively, because the test
        // compiler's header-value match is exact/case-sensitive.)
        .skipIf(
          not(responseHeader('accept-ranges')),
          'Target does not advertise range support (no Accept-Ranges header)',
        )
        // bytes=0-0 is a valid, byte-unit specifier that is satisfiable for any
        // representation of at least one octet.
        .replayStep((step) =>
          step
            .set(requestHeader('range'), constant('bytes=0-0'))
            .run({ checkStatusCode: false })
            .done(),
        )
        .transactions(([original, ranged]) => {
          // "Accept-Ranges: none" explicitly advertises no range support, so a
          // 200 is conformant. Matched case-insensitively on the original
          // response since the test compiler's value match is case-sensitive.
          const acceptRanges = getHeader(
            original.response?.headers,
            'accept-ranges',
          );
          const advertisesNone = (
            Array.isArray(acceptRanges)
              ? acceptRanges
              : acceptRanges != null
                ? [acceptRanges]
                : []
          ).some((value) => value.trim().toLowerCase() === 'none');
          if (advertisesNone) {
            return;
          }

          // 416 (empty representation) is conformant; only a full 200 means the
          // advertised, satisfiable range was ignored.
          if (ranged.response.statusCode === 200) {
            results.push({
              location: {
                elementType: 'edge',
                elementId: ranged.source.transactionId,
              },
              violation: {
                message:
                  'A server advertising range support (Accept-Ranges) returned 200 for a satisfiable byte-range request (bytes=0-0) instead of 206 Partial Content.',
              },
              findings: [],
            });
          }
        })
        .done(),
    );
    return results;
  })
  .done();
