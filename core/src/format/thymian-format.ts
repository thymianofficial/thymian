import { randomUUID } from 'node:crypto';

import { MultiDirectedGraph } from 'graphology';
import { match } from 'path-to-regexp';

import type { PartialBy } from '../utils.js';
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

export function isNodeType<T extends ThymianNode>(
  node: ThymianNode,
  type: keyof ThymianNodes
): node is T {
  return node.type === type;
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

export type ThymianNode = ThymianNodes[keyof ThymianNodes];
export type ThymianEdge = ThymianEdges[keyof ThymianEdges];

export type ThymianNodeType = keyof ThymianNodes;
export type ThymianEdgeType = keyof ThymianEdges;

export type ThymianGraph = MultiDirectedGraph<ThymianNode, ThymianEdge>;

export class ThymianFormat {
  readonly graph: ThymianGraph = new MultiDirectedGraph();

  addEdge(source: string, target: string, edge: ThymianEdge): string {
    return this.graph.addEdge(source, target, edge);
  }

  addHttpLink(
    source: string,
    target: string,
    edge: PartialBy<HttpLink, 'type'>
  ): string {
    return this.addEdge(source, target, {
      ...edge,
      type: 'http-link',
    });
  }

  addHttpTransaction(source: string, target: string): string {
    return this.addEdge(source, target, {
      type: 'http-transaction',
    });
  }

  addRequest(request: ThymianHttpRequest, id?: string): string {
    return this.addNode(
      {
        ...request,
        type: 'http-request',
      },
      id
    );
  }

  addResponse(response: ThymianHttpResponse, id?: string): string {
    return this.addNode(
      {
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

  getEdge<T extends ThymianEdge = ThymianEdge>(
    id: string
  ): ThymianEdge | undefined {
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

  httpResponsesOf(reqId: string): ThymianHttpResponse[] {
    return this.graph.reduceOutNeighbors(
      reqId,
      (acc, _, attributes) => {
        if (isNodeType<ThymianHttpResponse>(attributes, 'http-response')) {
          acc.push(attributes);
        }

        return acc;
      },
      [] as ThymianHttpResponse[]
    );
  }

  neighboursOfType<Type extends ThymianNodeType>(
    id: string,
    type: Type
  ): ThymianNodes[Type][] {
    return this.graph.reduceNeighbors(
      id,
      (acc, _, node) => {
        if (isNodeType<ThymianNodes[Type]>(node, type)) {
          acc.push(node);
        }

        return acc;
      },
      [] as ThymianNodes[Type][]
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

  matchHtpRequestByUrl(url: string): MatchResult | undefined {
    let urlObj: URL;

    if (/^(http|https)/.test(url)) {
      urlObj = new URL(url);
    } else {
      urlObj = new URL('http://localhost:8080/' + url);
    }

    const pathname = urlObj.pathname;

    return this.graph.reduceNodes((result, id, node) => {
      if (isNodeType<ThymianHttpRequest>(node, 'http-request')) {
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
      (id, node) =>
        isNodeType<ThymianNodes[Type]>(node, type) &&
        matchObjects(node, properties)
    );

    if (typeof nodeId === 'undefined') {
      return undefined;
    }

    return this.getNode<ThymianNodes[Type]>(nodeId);
  }
}
