// One list of plain data in place of a `format` and a hand-written
// `runRequest` router: each row is a Transaction as the API specification
// describes it, and what was actually observed for it. The harness derives
// what each context's engine needs from the list.

import type {
  CapturedTransaction,
  HttpParticipantRole,
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
  HttpTestContext,
  ThymianHttpRequest,
  ThymianHttpResponse,
  ThymianHttpTransaction,
} from '@thymian/core';
import { serializeRequest, ThymianFormat } from '@thymian/core';
import { exampleRequestSampler } from '@thymian/core-testing';

import type { CommonInput } from './run-in-context.js';

/**
 * One `Transaction` as the API specification describes it, and what was
 * actually observed for it. A context that observes only the specification
 * reads `described` alone.
 */
export type ObservedTransaction = {
  described: {
    request: ThymianHttpRequest;
    response: ThymianHttpResponse;
    /** Whether the described request is secured. Defaults to `false`. */
    secured?: boolean;
  };
  actual?: {
    /**
     * Pins the request `test` sends, and `analytics` records, for this
     * Transaction: the sampled request, with these fields in place of the
     * sampled ones.
     */
    request?: Partial<HttpRequest>;
    /**
     * The answer to that request. Defaults to the described status code, no
     * headers, no trailers and a duration of 1.
     */
    response?: Partial<HttpResponse>;
    /**
     * The participants `analytics` attributes the recorded traffic to.
     * Default to `user-agent` and `origin server`.
     */
    roles?: { request?: HttpParticipantRole; response?: HttpParticipantRole };
  };
};

/**
 * An input given as one `observed` list. It replaces the context's own
 * fields, such as `format` and `runRequest`, and does not mix with them.
 */
export type ObservedInput = CommonInput & { observed: ObservedTransaction[] };

export function isObserved(input: object): input is ObservedInput {
  return 'observed' in input;
}

const sourceName = 'rules-testing';

type ObservedFormat = {
  format: ThymianFormat;
  /** The row each Transaction of `format` was built from, by its id. */
  rowOf: Map<string, ObservedTransaction>;
  /**
   * The id of each row's Transaction, in row order. Rows that describe one
   * Transaction share its id.
   */
  transactionIds: string[];
};

/**
 * The `Thymian Format` the rows describe: every row's described pair, with
 * the request marked secured where the row says so.
 */
export function formatOf(observed: ObservedTransaction[]): ObservedFormat {
  const format = new ThymianFormat();
  const rowOf = new Map<string, ObservedTransaction>();
  const transactionIds: string[] = [];
  let schemeId: string | undefined;

  for (const row of observed) {
    const { request, response, secured = false } = row.described;
    const [reqId, , transactionId] = format.addHttpTransaction(
      request,
      response,
      sourceName,
    );
    rowOf.set(transactionId, row);
    transactionIds.push(transactionId);

    if (secured) {
      schemeId ??= format.addSecurityScheme({
        scheme: 'basic',
        sourceName,
        type: 'security-scheme',
      });
      format.addEdge(reqId, schemeId, {
        label: 'basic',
        type: 'is-secured',
        sourceName,
      });
    }
  }

  return { format, rowOf, transactionIds };
}

// The sampled request for `transaction`, with the row's pinned fields in
// place of the sampled ones.
async function sampledRequestOf(
  transaction: ThymianHttpTransaction,
  row: ObservedTransaction | undefined,
): Promise<HttpRequestTemplate> {
  return {
    ...(await exampleRequestSampler(transaction)),
    ...row?.actual?.request,
  };
}

// The row's actual response, over the described status code.
function answerOf(row: ObservedTransaction): HttpResponse {
  return {
    statusCode: row.described.response.statusCode,
    headers: {},
    trailers: {},
    duration: 1,
    ...row.actual?.response,
  };
}

function originOf(request: ThymianHttpRequest): string {
  return `${request.protocol}://${request.host}:${request.port}`;
}

// `https://h:443` and `https://h` are one origin.
function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return a === b;
  }
}

// A described path matches the concrete path sent for it: `/orders/{id}`
// matches `/orders/42`.
function pathPattern(path: string): RegExp {
  const escaped = path
    .split(/{[^}]+}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+');
  return new RegExp(`^${escaped}$`);
}

// A sent request reaches the row whose described request it was sampled
// from, by method, origin and path. A request a row pins elsewhere reaches
// no row.
type RowMatcher = {
  row: ObservedTransaction;
  method: string;
  origin: string;
  path: RegExp;
  templated: boolean;
};

function matcherOf(row: ObservedTransaction): RowMatcher {
  const { request } = row.described;
  return {
    row,
    method: request.method.toUpperCase(),
    origin: originOf(request),
    path: pathPattern(request.path),
    templated: request.path.includes('{'),
  };
}

/**
 * What the `test` context needs from the rows: the format, a sampler that
 * pins each row's `actual.request`, and a server that answers each sent
 * request with its row's `actual.response`.
 *
 * Throws when two rows describe one Operation: their sampled requests could
 * not be told apart. A request no row answers fails its test case, which the
 * engine reports rather than throws, so it is also kept in `unanswered` for
 * the harness to reject with.
 */
export function testContextOf(observed: ObservedTransaction[]): Pick<
  HttpTestContext,
  'format' | 'sampleRequest' | 'runRequest'
> & {
  unanswered: Error[];
} {
  // Rows are told apart by method, origin and path template, whatever its
  // parameters are named: `/orders/{id}` and `/orders/{orderId}` are one.
  const seen = new Set<string>();
  for (const { described } of observed) {
    const { request } = described;
    const method = request.method.toUpperCase();
    const key = `${method} ${originOf(request)}${request.path.replace(/{[^}]+}/g, '{}')}`;
    if (seen.has(key)) {
      throw new Error(
        `two rows of \`observed\` describe the Operation ${method} ${request.path}, ` +
          'and the `test` context tells rows apart only by method, origin and path: give it one row per Operation',
      );
    }
    seen.add(key);
  }

  const { format, rowOf } = formatOf(observed);
  // A literal path wins over a template that also matches it.
  const answers = observed
    .map(matcherOf)
    .sort((a, b) => Number(a.templated) - Number(b.templated));

  const unanswered: Error[] = [];

  return {
    format,
    unanswered,
    sampleRequest: async (transaction) =>
      sampledRequestOf(transaction, rowOf.get(transaction.transactionId)),
    runRequest: async (request): Promise<HttpResponse> => {
      const path = request.path.split('?')[0] ?? request.path;
      const answer = answers.find(
        (candidate) =>
          candidate.method === request.method.toUpperCase() &&
          sameOrigin(candidate.origin, request.origin) &&
          candidate.path.test(path),
      );
      if (!answer) {
        const error = new Error(
          `no row of \`observed\` answers ${request.method.toUpperCase()} ${request.path}`,
        );
        unanswered.push(error);
        throw error;
      }
      return answerOf(answer.row);
    },
  };
}

/**
 * What the `analytics` context needs from the rows: the format, and one
 * recorded transaction per row. Its request is the one `test` would send for
 * the row, serialized as the tester serializes it, so a templated path is
 * recorded at the concrete path the sampler gives it; its response is the one
 * `test` would answer with. Several rows may describe one Operation.
 */
export async function recordedTrafficOf(
  observed: ObservedTransaction[],
): Promise<{ format: ThymianFormat; transactions: CapturedTransaction[] }> {
  const { format, transactionIds } = formatOf(observed);

  const transactions = await Promise.all(
    observed.map(async (row, index): Promise<CapturedTransaction> => {
      const id = transactionIds[index] as string;
      const source = format.getThymianHttpTransactionById(id);
      if (!source) {
        throw new Error(`the format holds no Transaction ${id}`);
      }
      const requestTemplate = await sampledRequestOf(source, row);

      return {
        request: {
          data: serializeRequest({ requestTemplate, source }),
          meta: { role: row.actual?.roles?.request ?? 'user-agent' },
        },
        response: {
          data: answerOf(row),
          meta: { role: row.actual?.roles?.response ?? 'origin server' },
        },
      };
    }),
  );

  return { format, transactions };
}
