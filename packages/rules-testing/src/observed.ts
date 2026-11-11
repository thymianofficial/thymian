// One list of plain data in place of a `format` and a hand-written
// `runRequest` router: each row is a Transaction as the API specification
// describes it, and what was actually observed for it. The harness derives
// what each context's engine needs from the list.

import type {
  HttpParticipantRole,
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
  HttpTestContext,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '@thymian/core';
import { ThymianFormat } from '@thymian/core';
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
     * Pins the request `test` sends for this Transaction: the sampled
     * request, with these fields in place of the sampled ones.
     */
    request?: Partial<HttpRequest>;
    /**
     * The answer to that request. Defaults to the described status code, no
     * headers, no trailers and a duration of 1.
     */
    response?: Partial<HttpResponse>;
    /** The participants the recorded traffic is attributed to. */
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

type Built = {
  format: ThymianFormat;
  /** The row each Transaction of `format` was built from, by its id. */
  rowOf: Map<string, ObservedTransaction>;
};

/**
 * The `Thymian Format` the rows describe: every row's described pair, with
 * the request marked secured where the row says so.
 */
export function formatOf(observed: ObservedTransaction[]): Built {
  const format = new ThymianFormat();
  const rowOf = new Map<string, ObservedTransaction>();
  let schemeId: string | undefined;

  for (const row of observed) {
    const { request, response, secured = false } = row.described;
    const [reqId, , transactionId] = format.addHttpTransaction(
      request,
      response,
      sourceName,
    );
    rowOf.set(transactionId, row);

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

  return { format, rowOf };
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

function operationOf(row: ObservedTransaction): string {
  const { request } = row.described;
  return `${request.method.toUpperCase()} ${new URL(request.path, originOf(request))}`;
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
type Answering = {
  row: ObservedTransaction;
  method: string;
  origin: string;
  path: RegExp;
  templated: boolean;
};

function answering(row: ObservedTransaction): Answering {
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
  const seen = new Set<string>();
  for (const row of observed) {
    const operation = operationOf(row);
    if (seen.has(operation)) {
      throw new Error(
        `two rows of \`observed\` describe the Operation ${operation}; the \`test\` context takes one row per Operation`,
      );
    }
    seen.add(operation);
  }

  const { format, rowOf } = formatOf(observed);
  // A literal path wins over a template that also matches it.
  const answers = observed
    .map(answering)
    .sort((a, b) => Number(a.templated) - Number(b.templated));

  const unanswered: Error[] = [];

  return {
    format,
    unanswered,
    sampleRequest: async (transaction): Promise<HttpRequestTemplate> => {
      return {
        ...(await exampleRequestSampler(transaction)),
        ...rowOf.get(transaction.transactionId)?.actual?.request,
      };
    },
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
      return {
        statusCode: answer.row.described.response.statusCode,
        headers: {},
        trailers: {},
        duration: 1,
        ...answer.row.actual?.response,
      };
    },
  };
}
