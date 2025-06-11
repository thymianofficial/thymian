import { randomUUID } from 'node:crypto';

import { MultiDirectedGraph } from 'graphology';

import type {
  HttpLink,
  HttpTransaction,
  ThymianEdge,
  ThymianEdges,
} from './edges.js';
import {
  type ApiKeySecurityScheme,
  type BasicSecurityScheme,
  type BearerSecurityScheme,
  isNodeType,
  type SecurityScheme,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  type ThymianNode,
  type ThymianNodes,
} from './nodes.js';
import { match } from 'path-to-regexp';
import type { StringAndNumberProperties } from '../utils.js';

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && !Array.isArray(value) && value !== null;
}

function matchObjects(
  source: unknown,
  target: Record<PropertyKey, string | number | boolean>
): boolean {
  if (!isRecord(source)) return false;

  return Object.entries(target).every(
    ([key, value]) => key in source && source[key] === value
  );
}

export type MatchResult = {
  reqId: string;
  parameters: Partial<Record<string, string | string[]>>;
};

export type ThymianGraph<
  Nodes extends ThymianNode,
  Edges extends ThymianEdge
> = MultiDirectedGraph<ThymianNodes | Nodes, ThymianEdges | Edges>;

export class ThymianFormat<
  Nodes extends ThymianNode = ThymianNode,
  Edges extends ThymianEdge = ThymianEdge
> {
  readonly graph: MultiDirectedGraph<
    ThymianNodes | Nodes,
    ThymianEdges | Edges
  > = new MultiDirectedGraph();

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

  addNode<Node extends ThymianNodes>(
    node: Node,
    id: string = randomUUID()
  ): string {
    try {
      this.graph.addNode(id, node);
    } catch (e) {
      console.log(e);
    }

    return id;
  }

  getNode<T extends ThymianNode = ThymianNodes>(id: string): T | undefined {
    return this.graph.getNodeAttributes(id) as T;
  }

  getEdge(id: string): HttpLink | HttpTransaction | ThymianEdge | Edges {
    return this.graph.getEdgeAttributes(id);
  }

  findNodeByExtension(
    extensionName: string,
    values: Record<PropertyKey, string | number | boolean>
  ):
    | ThymianHttpRequest
    | ThymianHttpResponse
    | SecurityScheme
    | BasicSecurityScheme
    | BearerSecurityScheme
    | ApiKeySecurityScheme
    | ThymianNode
    | Nodes
    | undefined {
    const id = this.graph.findNode(
      (id, attributes) =>
        attributes.extensions &&
        extensionName in attributes.extensions &&
        matchObjects(attributes.extensions[extensionName], values)
    );

    return this.graph.getNodeAttributes(id);
  }

  httpResponsesOf(id: string): ThymianHttpResponse[] {
    return this.graph.reduceOutNeighbors(
      id,
      (acc, _, attributes) => {
        if (isNodeType<ThymianHttpResponse>(attributes, 'http-response')) {
          acc.push(attributes);
        }

        return acc;
      },
      [] as ThymianHttpResponse[]
    );
  }

  neighboursOfType(id: string, type: ThymianNodes['type']): ThymianNodes[] {
    return this.graph.reduceNeighbors(
      id,
      (acc, _, attributes) => {
        if (attributes.type === type) {
          acc.push(attributes);
        }

        return acc;
      },
      [] as ThymianNodes[]
    );
  }

  getNodesNodeByExtension(
    extensionName: string,
    values: Record<PropertyKey, string | number | boolean>
  ): (
    | ThymianHttpRequest
    | ThymianHttpResponse
    | SecurityScheme
    | BasicSecurityScheme
    | BearerSecurityScheme
    | ApiKeySecurityScheme
    | ThymianNode
    | Nodes
  )[] {
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

  findNode<Type extends ThymianNodes>(
    type: Type['type'],
    properties: StringAndNumberProperties<Type>
  ): Type | undefined {
    const nodeId = this.graph.findNode(
      (id, node) =>
        // TODO
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        isNodeType<Type>(node, type) && matchObjects(node, properties)
    );

    if (typeof nodeId === 'undefined') {
      return undefined;
    }

    return this.getNode<Type>(nodeId);
  }
}
