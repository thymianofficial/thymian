import { createHash, randomUUID } from 'node:crypto';

import {
  httpStatusCodeToPhrase,
  isValidHttpStatusCode,
} from '@thymian/http-status-codes';
import { MultiDirectedGraph } from 'graphology';
import type { SerializedGraph } from 'graphology-types';
import { match } from 'path-to-regexp';

import type { HttpRequest, HttpResponse } from '../http.js';
import { ThymianBaseError } from '../thymian.error.js';
import {
  capitalizeFirstChar,
  equalsIgnoreCase,
  getContentType,
  normalizeUrl,
  type PartialBy,
  thymianRequestToOrigin,
} from '../utils.js';
import { matchObjects, type StringAndNumberProperties } from '../utils.js';
import type { HttpLink } from './edges/http-link.edge.js';
import type { HttpTransaction } from './edges/http-transaction.edge.js';
import type { IsSecuredWith } from './edges/is-secured-with.edge.js';
import type { ThymianHttpRequest } from './nodes/http-request.node.js';
import type { ThymianHttpResponse } from './nodes/http-response.node.js';
import type { SecurityScheme } from './nodes/security-scheme.node.js';

export type MatchResult = {
  reqId: string;
  parameters: Partial<Record<string, string | string[]>>;
};

export function isNodeType<T extends ThymianNodeType>(
  node: ThymianNode,
  type: T
): node is ThymianNodes[T] {
  return node.type === type;
}

export function isEdgeType<T extends ThymianEdgeType>(
  edge: ThymianEdge,
  type: T
): edge is ThymianEdges[T] {
  return edge.type === type;
}

export interface ThymianNodes {
  'http-request': ThymianHttpRequest;
  'http-response': ThymianHttpResponse;
  'security-scheme': SecurityScheme;
}

export interface ThymianEdges {
  'http-link': HttpLink;
  'http-transaction': HttpTransaction;
  'is-secured': IsSecuredWith;
}

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

export type SerializedThymianFormat = SerializedGraph<ThymianNode, ThymianEdge>;

export function thymianHttpRequestToLabel(
  req: PartialBy<ThymianHttpRequest, 'label'>
): string {
  const label = `${req.method.toUpperCase()} ${req.protocol}://${req.host}:${
    req.port
  }${req.path.startsWith('/') ? req.path : '/' + req.path}`;

  return req.mediaType ? label + ` - ${req.mediaType}` : label;
}

export function thymianHttpResponseToLabel(
  res: PartialBy<ThymianHttpResponse, 'label'>
): string {
  const statusCode = res.statusCode;
  const phrase = isValidHttpStatusCode(statusCode)
    ? httpStatusCodeToPhrase[statusCode]
    : '';

  const label = `${statusCode} ${phrase.toUpperCase()}`;

  return res.mediaType ? label + ` - ${res.mediaType}` : label;
}

export class ThymianFormat {
  readonly graph: ThymianGraph;

  constructor(graph: ThymianGraph = new MultiDirectedGraph()) {
    this.graph = graph;
  }

  addEdge(
    source: string,
    target: string,
    edge: PartialBy<ThymianEdge, 'label'>
  ): string {
    return this.graph.addEdge(source, target, {
      label: edge.type,
      ...edge,
    });
  }

  addHttpLink(
    source: string,
    target: string,
    edge: PartialBy<HttpLink, 'type' | 'label'>
  ): string {
    const res = this.getNode<ThymianHttpResponse>(source);
    const req = this.getNode<ThymianHttpRequest>(target);

    if (!res || !req) {
      throw new ThymianBaseError('Invalid HTTP link.', {
        name: 'InvalidHttpLink',
      });
    }

    const label = `${thymianHttpResponseToLabel(
      res
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
    transaction: Partial<HttpTransaction> = {}
  ): [string, string] {
    const req = this.getNode<ThymianHttpRequest>(requestId);

    if (!req) {
      throw new Error(
        `Invalid request ID${requestId}. Cannot add response to request.`
      );
    }

    const resLabel = thymianHttpResponseToLabel(response);

    const resId = this.addResponse(
      { ...response, label: resLabel },
      this.hash(req.label + resLabel)
    );

    return [
      resId,
      this.addEdge(requestId, resId, {
        type: 'http-transaction',
        ...transaction,
        label: `${req.label} \u2192 ${resLabel}`,
      }),
    ];
  }

  addHttpTransaction(
    request: PartialBy<ThymianHttpRequest, 'label'>,
    response: PartialBy<ThymianHttpResponse, 'label'>
  ): [string, string, string] {
    const reqLabel = thymianHttpRequestToLabel(request);
    const resLabel = thymianHttpResponseToLabel(response);

    const reqId = this.hash(reqLabel);

    if (!this.graph.hasNode(reqId)) {
      this.addRequest({ ...request, label: reqLabel });
    }

    const resId = this.addResponse(
      { ...response, label: resLabel },
      this.hash(reqLabel + resLabel)
    );

    return [
      reqId,
      resId,
      this.addEdge(reqId, resId, {
        type: 'http-transaction',
        label: `${reqLabel} \u2192 ${resLabel}`,
      }),
    ];
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

    return this.addNode(
      {
        label,
        ...request,
        type: 'http-request',
      },
      this.hash(label)
    );
  }

  private addResponse(
    response: PartialBy<ThymianHttpResponse, 'label'>,
    id?: string
  ): string {
    const label = thymianHttpResponseToLabel(response);

    return this.addNode(
      {
        label,
        ...response,
        type: 'http-response',
      },
      id
    );
  }

  addNode(node: ThymianNode, id: string = randomUUID()): string {
    return this.graph.addNode(id, node);
  }

  getNode<T extends ThymianNode = ThymianNode>(id: string): T | undefined {
    return this.graph.getNodeAttributes(id) as T;
  }

  getEdge<T extends ThymianEdge = ThymianEdge>(id: string): T | undefined {
    return this.graph.getEdgeAttributes(id) as T;
  }

  findNodeByExtension(
    extensionName: string,
    values: Record<PropertyKey, string | number | boolean>
  ): ThymianNode | undefined {
    const id = this.graph.findNode(
      (id, attributes) =>
        attributes.extensions &&
        extensionName in attributes.extensions &&
        matchObjects(attributes.extensions[extensionName], values)
    );

    return this.graph.getNodeAttributes(id);
  }

  requestIsSecured(reqId: string): boolean {
    return !!this.graph.findOutEdge(reqId, (_, edge) =>
      isEdgeType(edge, 'is-secured')
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
            (_, edge) => edge.type === 'http-transaction'
          );

          if (!transactionId) {
            throw new Error('Invalid HTTP transaction.');
          }

          acc.push([id, attributes, transactionId]);
        }

        return acc;
      },
      [] as [string, ThymianHttpResponse, string][]
    );
  }

  getNeighboursOfType<Type extends ThymianNodeType>(
    id: string,
    type: Type
  ): [string, ThymianNodes[Type]][] {
    return this.graph.reduceNeighbors(
      id,
      (acc, id, node) => {
        if (isNodeType(node, type)) {
          acc.push([id, node]);
        }

        return acc;
      },
      [] as [string, ThymianNodes[Type]][]
    );
  }

  getNodesByExtension(
    extensionName: string,
    values: Record<PropertyKey, string | number | boolean>
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

  getHttpTransactions(): [string, string, string][] {
    return this.graph.reduceEdges((transactions, id, edge, source, target) => {
      if (edge.type === 'http-transaction') {
        transactions.push([source, target, id]);
      }

      return transactions;
    }, [] as [string, string, string][]);
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
      [] as ThymianHttpTransaction[]
    );
  }

  matchTransaction(
    req: HttpRequest,
    res: HttpResponse
  ): [string, string, string] | undefined {
    const edgeId = this.graph.findEdge(
      (id, edge, sourceId, targetId, source, target) => {
        if (!isEdgeType(edge, 'http-transaction')) return false;

        const thymianReq = source as ThymianHttpRequest;
        const thymianRes = target as ThymianHttpResponse;

        const origin = thymianRequestToOrigin(thymianReq);
        const reqMediaType = getContentType(req.headers);
        const resMediaType = getContentType(res.headers);

        const reqOriginUrl = normalizeUrl(req.origin);

        return (
          equalsIgnoreCase(thymianReq.method, req.method) &&
          equalsIgnoreCase(thymianReq.path, req.path) &&
          equalsIgnoreCase(origin, reqOriginUrl.toString()) &&
          thymianRes.statusCode === res.statusCode &&
          equalsIgnoreCase(reqMediaType, thymianReq.mediaType) &&
          equalsIgnoreCase(resMediaType, thymianRes.mediaType)
        );
      }
    );

    if (!edgeId) {
      return undefined;
    }

    return [edgeId, ...this.graph.extremities(edgeId)];
  }

  matchHtpRequestByUrl(url: string): MatchResult | undefined {
    let urlObj: URL;

    if (/^(http|https)/.test(url)) {
      urlObj = new URL(url);
    } else {
      urlObj = new URL('http://localhost:8080' + url);
    }

    const pathname = urlObj.pathname;

    return this.graph.reduceNodes((result, id, node) => {
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
    }, undefined as MatchResult | undefined);
  }

  findNode<Type extends ThymianNodeType>(
    type: Type,
    properties: StringAndNumberProperties<ThymianNodes[Type]>
  ): ThymianNodes[Type] | undefined {
    const nodeId = this.graph.findNode(
      (id, node) => isNodeType(node, type) && matchObjects(node, properties)
    );

    if (typeof nodeId === 'undefined') {
      return undefined;
    }

    return this.getNode<ThymianNodes[Type]>(nodeId);
  }

  export(): SerializedThymianFormat {
    return this.graph.export();
  }

  toJSON(): SerializedThymianFormat {
    return this.export();
  }

  // TODO must implement this feature. But before we should think about the node and edge ID generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  merge(format: ThymianFormat): ThymianFormat {
    return this;
  }

  static import(graph: SerializedThymianFormat): ThymianFormat {
    return new ThymianFormat(
      new MultiDirectedGraph<ThymianNode, ThymianEdge>().import(graph)
    );
  }

  private hash(input: string): string {
    return createHash('sha1').update(input).digest('hex');
  }
}
