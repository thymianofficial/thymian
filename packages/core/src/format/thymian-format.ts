import { createHash } from 'node:crypto';

import { MultiDirectedGraph } from 'graphology';
import type { SerializedGraph } from 'graphology-types';
import { match } from 'path-to-regexp';
import stringify from 'safe-stable-stringify';

import type { HttpRequest, HttpResponse } from '../http.js';
import type { HttpFilterExpression } from '../http-filter.js';
import {
  httpStatusCodeToPhrase,
  isValidHttpStatusCode,
} from '../http-status-codes/index.js';
import { ThymianBaseError } from '../thymian.error.js';
import {
  capitalizeFirstChar,
  equalsIgnoreCase,
  getContentType,
  httpRequestToLabel,
  httpResponseToLabel,
  matchesMediaType,
  normalizeUrl,
  type PartialBy,
  thymianRequestToOrigin,
} from '../utils.js';
import { matchObjects, type StringAndNumberProperties } from '../utils.js';
import type { HasSample } from './edges/has-sample.edge.js';
import type { HttpLink } from './edges/http-link.edge.js';
import type { HttpTransaction } from './edges/http-transaction.edge.js';
import type { IsSecuredWith } from './edges/is-secured-with.edge.js';
import type { SampleHttpTransaction } from './edges/sample-http-transaction.edge.js';
import { httpFilterExpressionToTransactionFilter } from './http-filter-expression-to-transaction-filter.js';
import type { ThymianHttpRequest } from './nodes/http-request.node.js';
import type { ThymianHttpResponse } from './nodes/http-response.node.js';
import type { SampleHttpRequest } from './nodes/sample-http-request.node.js';
import type { SampleHttpResponse } from './nodes/sample-http-response.node.js';
import type { SecurityScheme } from './nodes/security-scheme.node.js';
import {
  httpRequestToThymianHttpRequest,
  httpResponseToThymianHttpResponse,
} from './utils.js';

export type MatchResult = {
  reqId: string;
  parameters: Partial<Record<string, string | string[]>>;
};

export function isNodeType<T extends ThymianNodeType>(
  node: ThymianNode,
  type: T,
): node is ThymianNodes[T] {
  return node.type === type;
}

export function isEdgeType<T extends ThymianEdgeType>(
  edge: ThymianEdge,
  type: T,
): edge is ThymianEdges[T] {
  return edge.type === type;
}

export interface ThymianNodes {
  'http-request': ThymianHttpRequest;
  'http-response': ThymianHttpResponse;
  'security-scheme': SecurityScheme;
  'sample-http-request': SampleHttpRequest;
  'sample-http-response': SampleHttpResponse;
}

export interface ThymianEdges {
  'http-link': HttpLink;
  'http-transaction': HttpTransaction;
  'is-secured': IsSecuredWith;
  'sample-http-transaction': SampleHttpTransaction;
  'has-sample': HasSample;
}

/**
 * Where a recorded request/response pair lands in the format (ADR-0027).
 * Matching resolves the operation first, then the response within it:
 *
 * - `unknown-operation`: no request node matches method, path, origin and
 *   request media type.
 * - `undocumented-response`: the operation is documented, the response is not
 *   (an **Undocumented Response**). `undocumented` says whether no response
 *   covers the status, or the status is covered (concretely, or by `default`)
 *   but none of its media types matches.
 * - `matched`: a full match to one Transaction.
 */
export type TransactionResolution =
  | { kind: 'unknown-operation' }
  | {
      kind: 'undocumented-response';
      requestId: string;
      undocumented: 'status';
      /**
       * The operation's documented statuses in numeric order. Never holds
       * `default`: an operation that declares `default` covers every status,
       * so its misses are media-type misses.
       */
      documentedStatuses: number[];
    }
  | {
      kind: 'undocumented-response';
      requestId: string;
      undocumented: 'media-type';
      /** The status whose media types were searched: concrete or `default`. */
      statusCode: ThymianHttpResponse['statusCode'];
      documentedMediaTypes: string[];
    }
  | {
      kind: 'matched';
      transactionId: string;
      requestId: string;
      responseId: string;
    };

export type ThymianHttpTransaction = {
  thymianReq: ThymianHttpRequest;
  thymianReqId: string;
  thymianRes: ThymianHttpResponse;
  thymianResId: string;
  transactionId: string;
  transaction: HttpTransaction;
};

export type ThymianNode = ThymianNodes[keyof ThymianNodes];
export type ThymianEdge = ThymianEdges[keyof ThymianEdges];

export type ThymianNodeType = keyof ThymianNodes;
export type ThymianEdgeType = keyof ThymianEdges;

export type ThymianGraph = MultiDirectedGraph<ThymianNode, ThymianEdge>;

export type SerializedThymianFormat = SerializedGraph<
  ThymianNode,
  ThymianEdge,
  { hash: string }
>;

export type SerializedThymianFormatWithoutSourceName = SerializedGraph<
  PartialBy<ThymianNode, 'sourceName'>,
  PartialBy<ThymianEdge, 'sourceName'>,
  { hash: string }
>;

export function thymianHttpRequestToLabel(
  req: PartialBy<ThymianHttpRequest, 'label' | 'sourceName'>,
): string {
  const label = `${req.method.toUpperCase()} ${req.protocol}://${req.host}:${
    req.port
  }${req.path.startsWith('/') ? req.path : '/' + req.path}`;

  return req.mediaType ? label + ` - ${req.mediaType}` : label;
}

export function thymianHttpResponseToLabel(
  res: PartialBy<ThymianHttpResponse, 'label' | 'sourceName'>,
): string {
  const statusCode = res.statusCode;
  const phrase = isValidHttpStatusCode(statusCode)
    ? httpStatusCodeToPhrase[statusCode]
    : '';

  // A default response has no status and so no reason phrase (ADR-0027).
  const label =
    statusCode === 'default'
      ? statusCode
      : `${statusCode} ${phrase.toUpperCase()}`;

  return res.mediaType ? label + ` - ${res.mediaType}` : label;
}

export class ThymianFormat {
  readonly graph: ThymianGraph;

  static readonly ignoredNodeProperties: string[] = ['x', 'y'];
  private static readonly ignoredHashProperties = [
    'label',
    'sourceLocation',
    'sourceName',
  ] as const;

  constructor(graph: ThymianGraph = new MultiDirectedGraph()) {
    this.graph = graph;
  }

  addEdge(
    source: string,
    target: string,
    edge: PartialBy<ThymianEdge, 'label'>,
    options: {
      throwIfExists?: boolean;
    } = {},
  ): string {
    const e = {
      label: edge.type,
      ...edge,
    };

    const id = this.hash(source, target, this.semanticHashObj(e));

    if (this.graph.hasEdge(id)) {
      if (options.throwIfExists) {
        throw new Error(`Edge with ID ${id} already exists.`);
      }

      return id;
    }

    return this.graph.addEdgeWithKey(id, source, target, {
      label: edge.type,
      ...edge,
    });
  }

  addHttpLink(
    source: string,
    target: string,
    edge: PartialBy<HttpLink, 'type' | 'label'>,
  ): string {
    const res = this.getNode<ThymianHttpResponse>(source);
    const req = this.getNode<ThymianHttpRequest>(target);

    if (!res || !req) {
      throw new ThymianBaseError('Invalid HTTP link.', {
        name: 'InvalidHttpLink',
        ref: 'https://thymian.dev/references/errors/invalid-http-link/',
      });
    }

    const label = `${thymianHttpResponseToLabel(
      res,
    )} \u2192 ${thymianHttpRequestToLabel(req)}`;

    return this.addEdge(source, target, {
      label,
      ...edge,
      type: 'http-link',
    });
  }

  addResponseToRequest(
    requestId: string,
    response: PartialBy<ThymianHttpResponse, 'label'>,
    transaction: Partial<HttpTransaction> = {},
    sourceName?: string,
  ): [string, string] {
    const req = this.getNode<ThymianHttpRequest>(requestId);

    if (!req) {
      throw new Error(
        `Invalid request ID${requestId}. Cannot add response to request.`,
      );
    }

    const resLabel = thymianHttpResponseToLabel(response);

    const res: ThymianHttpResponse = {
      label: resLabel,
      ...response,
      type: 'http-response',
    };

    // Generate unique ID by combining request ID with response hash
    // This ensures each request has its own response nodes, even if response content is identical
    const responseNodeId = this.hash(requestId, this.semanticHashObj(res));

    const resId = this.addResponse(res, responseNodeId);

    return [
      resId,
      this.addEdge(requestId, resId, {
        type: 'http-transaction',
        ...transaction,
        label: `${req.label} \u2192 ${resLabel}`,
        sourceName: sourceName ?? req.sourceName,
      }),
    ];
  }

  addHttpTransaction(
    request: PartialBy<ThymianHttpRequest, 'label' | 'sourceName'>,
    response: PartialBy<ThymianHttpResponse, 'label' | 'sourceName'>,
    sourceName: string,
  ): [string, string, string] {
    const reqId = this.addRequest({ sourceName, ...request });
    const [resId, transactionId] = this.addResponseToRequest(reqId, {
      sourceName,
      ...response,
    });

    return [reqId, resId, transactionId];
  }

  addSecurityScheme(scheme: PartialBy<SecurityScheme, 'label'>): string {
    let label = capitalizeFirstChar(scheme.scheme);

    if (scheme.scheme === 'bearer' && 'bearerFormat' in scheme) {
      label += scheme.bearerFormat;
    } else if (scheme.scheme === 'api-key' && 'in' in scheme) {
      label += scheme.in;
    }

    label += 'Auth';

    return this.addNode({
      label,
      ...scheme,
    });
  }

  addRequest(request: PartialBy<ThymianHttpRequest, 'label'>): string {
    const label = thymianHttpRequestToLabel(request);

    return this.addNode({
      label,
      ...request,
      type: 'http-request',
    });
  }

  private addResponse(
    response: PartialBy<ThymianHttpResponse, 'label'>,
    id?: string,
  ): string {
    const label = thymianHttpResponseToLabel(response);

    return this.addNode(
      {
        label,
        ...response,
        type: 'http-response',
      },
      id,
    );
  }

  addNode(
    node: ThymianNode,
    id: string = this.semanticHashObj(node),
    options: {
      throwIfExists?: boolean;
    } = {},
  ): string {
    if (this.graph.hasNode(id)) {
      if (options.throwIfExists) {
        throw new Error(`Node with ID ${id} already exists.`);
      }

      return id;
    } else {
      return this.graph.addNode(id, node);
    }
  }

  getNode<T extends ThymianNode = ThymianNode>(id: string): T | undefined {
    return this.graph.getNodeAttributes(id) as T;
  }

  getEdge<T extends ThymianEdge = ThymianEdge>(id: string): T | undefined {
    return this.graph.getEdgeAttributes(id) as T;
  }

  findNodeByExtension(
    extensionName: string,
    values: Record<PropertyKey, string | number | boolean>,
  ): ThymianNode | undefined {
    const id = this.graph.findNode(
      (id, attributes) =>
        attributes.extensions &&
        extensionName in attributes.extensions &&
        matchObjects(attributes.extensions[extensionName], values),
    );

    return this.graph.getNodeAttributes(id);
  }

  requestIsSecured(reqId: string): boolean {
    return !!this.graph.findOutEdge(reqId, (_, edge) =>
      isEdgeType(edge, 'is-secured'),
    );
  }

  getHttpResponsesOf(reqId: string): [string, ThymianHttpResponse, string][] {
    return this.graph.reduceOutNeighbors(
      reqId,
      (acc, id, attributes) => {
        if (isNodeType(attributes, 'http-response')) {
          const transactionId = this.graph.findEdge(
            reqId,
            id,
            (_, edge) => edge.type === 'http-transaction',
          );

          if (!transactionId) {
            throw new Error('Invalid HTTP transaction.');
          }

          acc.push([id, attributes, transactionId]);
        }

        return acc;
      },
      [] as [string, ThymianHttpResponse, string][],
    );
  }

  getNeighboursOfType<Type extends ThymianNodeType>(
    id: string,
    type: Type,
  ): [string, ThymianNodes[Type]][] {
    return this.graph.reduceNeighbors(
      id,
      (acc, id, node) => {
        if (isNodeType(node, type)) {
          acc.push([id, node]);
        }

        return acc;
      },
      [] as [string, ThymianNodes[Type]][],
    );
  }

  getThymianHttpRequestsWithResponses(): [
    ThymianHttpRequest,
    ThymianHttpResponse[],
    string,
    string[],
  ][] {
    return this.graph.reduceNodes(
      (
        acc: [ThymianHttpRequest, ThymianHttpResponse[], string, string[]][],
        id,
        node,
      ) => {
        if (isNodeType(node, 'http-request')) {
          const responses = this.getHttpResponsesOf(id);

          acc.push([
            node,
            responses.map(([, res]) => res),
            id,
            responses.map(([id]) => id),
          ]);
        }

        return acc;
      },
      [],
    );
  }

  getNodesByExtension(
    extensionName: string,
    values: Record<PropertyKey, string | number | boolean>,
  ): ThymianNode[] {
    return this.graph.reduceNodes((acc, _, attributes) => {
      if (
        attributes.extensions &&
        extensionName in attributes.extensions &&
        matchObjects(attributes.extensions[extensionName], values)
      ) {
        acc.push(attributes);
      }
      return acc;
    }, [] as ThymianNode[]);
  }

  getThymianHttpRequestsWithIds(): [ThymianHttpRequest, string][] {
    return this.graph.reduceNodes(
      (requests: [ThymianHttpRequest, string][], id, node) => {
        if (isNodeType(node, 'http-request')) {
          requests.push([node, id]);
        }

        return requests;
      },
      [],
    );
  }

  getHttpTransactions(): [string, string, string][] {
    return this.graph.reduceEdges(
      (transactions, id, edge, source, target) => {
        if (edge.type === 'http-transaction') {
          transactions.push([source, target, id]);
        }

        return transactions;
      },
      [] as [string, string, string][],
    );
  }

  getThymianHttpRequests(): ThymianHttpRequest[] {
    return this.graph.reduceNodes(
      (requests: ThymianHttpRequest[], id, node) => {
        if (isNodeType(node, 'http-request')) {
          requests.push(node);
        }

        return requests;
      },
      [],
    );
  }

  getThymianHttpTransactionById(
    id: string,
  ): ThymianHttpTransaction | undefined {
    let edge;

    try {
      edge = this.getEdge<HttpTransaction>(id);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      /*empty*/
    }

    if (!edge) {
      return undefined;
    }

    const [reqId, resId] = this.graph.extremities(id);

    if (!reqId || !resId) {
      return undefined;
    }

    const req = this.getNode<ThymianHttpRequest>(reqId);
    const res = this.getNode<ThymianHttpResponse>(resId);

    if (!req || !res) {
      return undefined;
    }

    return {
      thymianReq: req,
      thymianReqId: reqId,
      thymianRes: res,
      thymianResId: resId,
      transactionId: id,
      transaction: edge,
    };
  }

  getThymianHttpTransactions(): ThymianHttpTransaction[] {
    return this.graph.reduceEdges(
      (transactions, id, edge, sourceId, targetId, source, target) => {
        if (isEdgeType(edge, 'http-transaction')) {
          transactions.push({
            thymianReq: source as ThymianHttpRequest,
            thymianReqId: sourceId,
            thymianRes: target as ThymianHttpResponse,
            thymianResId: targetId,
            transactionId: id,
            transaction: edge,
          });
        }

        return transactions;
      },
      [] as ThymianHttpTransaction[],
    );
  }

  /**
   * The full match of a recorded pair, or `undefined` for anything less — an
   * unknown operation and an Undocumented Response alike. Use
   * {@link resolveTransaction} to tell those two apart.
   */
  matchTransaction(
    req: HttpRequest,
    res: HttpResponse,
  ): [string, string, string] | undefined {
    const resolution = this.resolveTransaction(req, res);

    return resolution.kind === 'matched'
      ? [resolution.transactionId, resolution.requestId, resolution.responseId]
      : undefined;
  }

  /**
   * Resolves a recorded pair in two stages (ADR-0027). First the operation:
   * method, path, origin and request media type, tried as exact path, then
   * strict template, then template with any origin; more than one candidate at
   * a tier is no match. Then the response, among that operation's responses
   * only: a concrete status equal to the observed one (a media-type miss there
   * does not fall back to `default`), else `default` by media type, else the
   * status is undocumented.
   */
  resolveTransaction(
    req: HttpRequest,
    res: HttpResponse,
  ): TransactionResolution {
    const requestId = this.resolveOperation(req);

    if (!requestId) {
      return { kind: 'unknown-operation' };
    }

    const resMediaType = getContentType(res.headers);
    const responses = this.getHttpResponsesOf(requestId);
    // A documented concrete status is searched alone: OpenAPI selects the
    // response by status first, so a media-type miss there is not `default`'s.
    const searchedStatus: ThymianHttpResponse['statusCode'] = responses.some(
      ([, { statusCode }]) => statusCode === res.statusCode,
    )
      ? res.statusCode
      : 'default';
    const candidates = responses.filter(
      ([, { statusCode }]) => statusCode === searchedStatus,
    );

    if (candidates.length === 0) {
      return {
        kind: 'undocumented-response',
        requestId,
        undocumented: 'status',
        documentedStatuses: [
          ...new Set(
            responses.flatMap(([, { statusCode }]) =>
              statusCode === 'default' ? [] : [statusCode],
            ),
          ),
        ].sort((a, b) => a - b),
      };
    }

    const matches = candidates.filter(([, thymianRes]) =>
      matchesMediaType(thymianRes, resMediaType),
    );

    if (matches.length === 1 && matches[0]) {
      const [responseId, , transactionId] = matches[0];

      return { kind: 'matched', transactionId, requestId, responseId };
    }

    if (matches.length > 1) {
      // Two documented responses claim the pair; as before staged matching,
      // an ambiguous match is no match.
      return { kind: 'unknown-operation' };
    }

    return {
      kind: 'undocumented-response',
      requestId,
      undocumented: 'media-type',
      statusCode: searchedStatus,
      documentedMediaTypes: [
        ...new Set(candidates.map(([, { mediaType }]) => mediaType)),
      ],
    };
  }

  /** Stage 1 of {@link resolveTransaction}: the one matching request node. */
  private resolveOperation(req: HttpRequest): string | undefined {
    const reqMediaType = getContentType(req.headers);
    const reqOriginUrl = normalizeUrl(req.origin);
    const reqPath = new URL(req.path, reqOriginUrl).pathname;
    const matchesTemplate = (thymianReq: ThymianHttpRequest): boolean =>
      !!match(thymianReq.path.replaceAll(/{([^}]+)}/gi, ':$1'))(reqPath);
    const matchingRequests = (
      matchesPath: (thymianReq: ThymianHttpRequest) => boolean,
      ignoreOrigin = false,
    ): string[] =>
      this.graph.reduceNodes((matches, id, node) => {
        if (
          isNodeType(node, 'http-request') &&
          equalsIgnoreCase(node.method, req.method) &&
          matchesPath(node) &&
          (ignoreOrigin ||
            equalsIgnoreCase(
              thymianRequestToOrigin(node),
              reqOriginUrl.toString(),
            )) &&
          matchesMediaType(node, reqMediaType)
        ) {
          matches.push(id);
        }

        return matches;
      }, [] as string[]);

    const tiers: {
      matchesPath: (thymianReq: ThymianHttpRequest) => boolean;
      ignoreOrigin: boolean;
    }[] = [
      {
        matchesPath: (thymianReq) => equalsIgnoreCase(thymianReq.path, reqPath),
        ignoreOrigin: false,
      },
      { matchesPath: matchesTemplate, ignoreOrigin: false },
      { matchesPath: matchesTemplate, ignoreOrigin: true },
    ];

    for (const { matchesPath, ignoreOrigin } of tiers) {
      const matches = matchingRequests(matchesPath, ignoreOrigin);

      if (matches.length > 0) {
        return matches.length === 1 ? matches[0] : undefined;
      }
    }

    return undefined;
  }

  matchHtpRequestByUrl(url: string): MatchResult | undefined {
    let urlObj: URL;

    if (/^(http|https)/.test(url)) {
      urlObj = new URL(url);
    } else {
      urlObj = new URL('http://localhost:8080' + url);
    }

    const pathname = urlObj.pathname;

    return this.graph.reduceNodes(
      (result, id, node) => {
        if (isNodeType(node, 'http-request')) {
          const path = node.path.replaceAll(/{([^}]+)}/gi, ':$1');

          const matchFn = match(path);

          const r = matchFn(pathname);

          if (r) {
            result = {
              reqId: id,
              parameters: r.params,
            };
          }
        }

        return result;
      },
      undefined as MatchResult | undefined,
    );
  }

  findNode<Type extends ThymianNodeType>(
    type: Type,
    properties: StringAndNumberProperties<ThymianNodes[Type]>,
  ): ThymianNodes[Type] | undefined {
    const nodeId = this.graph.findNode(
      (id, node) => isNodeType(node, type) && matchObjects(node, properties),
    );

    if (typeof nodeId === 'undefined') {
      return undefined;
    }

    return this.getNode<ThymianNodes[Type]>(nodeId);
  }

  addSampleHttpRequest(request: HttpRequest, sourceName: string): string {
    return this.addNode({
      type: 'sample-http-request',
      label: httpRequestToLabel(request),
      sample: request,
      sourceName,
    });
  }

  addSampleHttpResponse(response: HttpResponse, sourceName: string): string {
    return this.addNode({
      type: 'sample-http-response',
      label: httpResponseToLabel(response),
      sample: response,
      sourceName,
    });
  }

  addSampleHttpTransaction(
    request: HttpRequest,
    response: HttpResponse,
    sourceName: string,
  ): [string, string, string] {
    const reqId = this.addSampleHttpRequest(request, sourceName);
    const resId = this.addSampleHttpResponse(response, sourceName);
    const transactionId = this.addEdge(reqId, reqId, {
      type: 'sample-http-transaction',
      label: `Sample HTTP Transaction`,
      sourceName,
    });

    return [reqId, resId, transactionId];
  }

  toHash(): string {
    const hash = createHash('sha1');
    const nodeHashes = new Map(
      this.graph
        .nodes()
        .map(
          (id) =>
            [
              id,
              this.semanticHashObj(this.graph.getNodeAttributes(id)),
            ] as const,
        ),
    );

    [...nodeHashes.values()]
      .sort()
      .forEach((nodeHash) => hash.update(nodeHash));

    this.graph
      .edges()
      .map((id) => {
        const [source, target] = this.graph.extremities(id);

        return this.hash(
          nodeHashes.get(source) ?? '',
          nodeHashes.get(target) ?? '',
          this.semanticHashObj(this.graph.getEdgeAttributes(id)),
        );
      })
      .sort()
      .forEach((edgeHash) => hash.update(edgeHash));

    return hash.digest('hex');
  }

  export(): SerializedThymianFormat {
    return {
      ...this.graph.export(),
      attributes: {
        hash: this.toHash(),
      },
    };
  }

  // TODO must implement this feature. But before we should think about the node and edge ID generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  merge(format: ThymianFormat): ThymianFormat {
    return this;
  }

  filter(expression: HttpFilterExpression): ThymianFormat;
  filter(
    fn: (
      transaction: ThymianHttpTransaction,
      transactions: ThymianHttpTransaction[],
    ) => boolean,
  ): ThymianFormat;
  filter(
    fn:
      | ((
          transaction: ThymianHttpTransaction,
          transactions: ThymianHttpTransaction[],
        ) => boolean)
      | HttpFilterExpression,
  ): ThymianFormat {
    const copied = this.graph.copy();

    const filterFn =
      typeof fn === 'function'
        ? fn
        : httpFilterExpressionToTransactionFilter(fn);

    // 1. if the filter function returns false for a transaction, its corresponding edge is dropped
    this.getThymianHttpTransactions()
      .filter(
        (transaction, _, transactions) =>
          !filterFn(transaction, transactions, this),
      )
      .forEach((transaction) => {
        copied.dropEdge(transaction.transactionId);
      });

    // after that, all nodes that have no outgoing edges are dropped if they are http-request or http-response nodes
    copied.forEachNode((id, node) => {
      if (
        (isNodeType(node, 'http-request') ||
          isNodeType(node, 'http-response')) &&
        copied.neighbors(id).length === 0
      ) {
        copied.dropNode(id);
      }
    });

    return new ThymianFormat(copied);
  }

  static fromHttpTransactions(
    transactions: [HttpRequest, HttpResponse][],
    sourceName: string,
  ): ThymianFormat {
    const format = new ThymianFormat();

    for (const [req, res] of transactions) {
      const thymianReq = httpRequestToThymianHttpRequest(req, sourceName);
      const thymianRes = httpResponseToThymianHttpResponse(res, sourceName);

      const [sampleReqId, sampleResId] = format.addSampleHttpTransaction(
        req,
        res,
        sourceName,
      );

      const [reqId, resId] = format.addHttpTransaction(
        thymianReq,
        thymianRes,
        sourceName,
      );

      format.addEdge(reqId, sampleReqId, {
        type: 'has-sample',
        sourceName,
      });
      format.addEdge(resId, sampleResId, {
        type: 'has-sample',
        sourceName,
      });
    }

    return format;
  }

  static import(graph: SerializedThymianFormat): ThymianFormat;
  static import(
    graph: SerializedThymianFormatWithoutSourceName,
    sourceName: string,
  ): ThymianFormat;
  static import(
    graph: SerializedThymianFormatWithoutSourceName | SerializedThymianFormat,
    sourceName?: string,
  ): ThymianFormat {
    const g = new MultiDirectedGraph<
      PartialBy<ThymianNode, 'sourceName'> | ThymianNode,
      PartialBy<ThymianEdge, 'sourceName'> | ThymianEdge
    >().import(graph);

    g.forEachNode((_, node) => {
      node.sourceName ??= sourceName;
    });

    g.forEachEdge((_, edge) => {
      edge.sourceName ??= sourceName;
    });

    return new ThymianFormat(g as ThymianGraph);
  }

  private hash(...values: string[]): string {
    const hash = createHash('sha1');

    values.forEach((value) => hash.update(value));

    return hash.digest('hex');
  }

  private hashObj(obj: unknown): string {
    if (typeof obj === 'undefined') {
      return '';
    }

    return createHash('sha1').update(stringify(obj)).digest('hex');
  }

  private semanticHashObj(obj: unknown): string {
    if (typeof obj === 'undefined') {
      return '';
    }

    if (!obj || typeof obj !== 'object') {
      return this.hashObj(obj);
    }

    return this.hashObj(this.removeIgnoredHashProperties(obj));
  }

  private removeIgnoredHashProperties(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((value) => this.removeIgnoredHashProperties(value));
    }

    const attributes = { ...(obj as Record<string, unknown>) };

    ThymianFormat.ignoredHashProperties.forEach((property) => {
      delete attributes[property];
    });

    Object.entries(attributes).forEach(([key, value]) => {
      attributes[key] = this.removeIgnoredHashProperties(value);
    });

    return attributes;
  }
}
