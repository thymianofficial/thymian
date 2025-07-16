import {
  equalsIgnoreCase,
  httpRule,
  type RuleViolation,
} from '@thymian/http-linter';
import {
  defineStep,
  expect,
  overrideHeaders,
  replayStep,
  runRequests,
} from '@thymian/http-testing';
import { createList } from '../../../../utils.js';
import { representationFields } from '../../../fields.js';
import { requiredHeadersFor304 } from './server-must-generate-header-fields-for-304-response.rule.js';

export function checkHeaders(
  notModifiedHeaders: string[],
  transactionId: string
): RuleViolation | undefined {
  const additionalHeaders = representationFields.filter(
    (header) =>
      !equalsIgnoreCase(header, ...requiredHeadersFor304) &&
      equalsIgnoreCase(header, ...notModifiedHeaders)
  );

  if (additionalHeaders.length > 0) {
    return {
      message: `304 Not Modified response SHOULD NOT include additional headers ${createList(
        additionalHeaders
      )}.`,
      location: {
        elementType: 'edge',
        elementId: transactionId,
      },
    };
  }

  return undefined;
}

export default httpRule(
  'rfc9110/sender-should-not-generate-additional-representation-metadata-for-304-response'
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified')
  .summary('A sender SHOULD NOT generate additional representation metadata.')
  .description(
    'Since the goal of a 304 response is to minimize information transfer when the recipient already has one or more cached representations, a sender SHOULD NOT generate representation metadata other than the above listed fields unless said metadata exists for the purpose of guiding cache updates (e.g., Last-Modified might be useful if the response does not have an ETag field).'
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (req, res) =>
        equalsIgnoreCase(req.method, 'get', 'head') && res.statusCode === 304,
      (req, res, transactionId) => checkHeaders(res.headers, transactionId)
    )
  )
  .overrideTest((testContext) =>
    testContext.test((test) =>
      test.pipe(
        defineStep({
          reqFilter: (req) => equalsIgnoreCase(req.method, 'get', 'head'),
          resFilter: (res) => res.statusCode === 200,
        }),
        replayStep((step) =>
          step.pipe(
            overrideHeaders((headers, testCase) => {
              const transaction = testCase.steps[0].transactions[0];

              if (!transaction) {
                throw new Error('Previous step does not have transaction.');
              }

              const etag = transaction.response?.headers['etag'];

              if (typeof etag === 'string') {
                headers['if-none-match'] = etag;
              }

              return headers;
            }),
            runRequests({ checkStatusCode: false })
          )
        ),
        expect(({ curr }) => {
          const okTransaction = curr.steps[0].transactions[0];
          const notModifiedTransaction = curr.steps[1].transactions[0];

          if (
            okTransaction &&
            notModifiedTransaction &&
            notModifiedTransaction.response?.statusCode === 304
          ) {
            if (
              okTransaction.response &&
              notModifiedTransaction.response &&
              notModifiedTransaction.source?.transactionId
            ) {
              let transactionId = notModifiedTransaction.source.transactionId;

              const notModifiedResponse = testContext.format
                .getHttpResponsesOf(notModifiedTransaction.source.thymianReqId)
                .find(([, res]) => res.statusCode === 304);

              if (notModifiedResponse) {
                transactionId = notModifiedResponse[2];
              }

              const violation = checkHeaders(
                Object.keys(notModifiedTransaction.response.headers ?? {}),
                transactionId
              );

              if (violation) {
                testContext.report(violation);
              }
            }
          }
        })
      )
    )
  )
  .done();
