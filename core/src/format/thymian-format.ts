import { ThymianSchema } from './schema/index.js';
import { SerializationStyle } from './serialization-style/index.js';
import { MultiDirectedGraph } from 'graphology';
import { randomUUID } from 'node:crypto';
import type {
  ApiKeySecurityScheme,
  BasicSecurityScheme,
  BearerSecurityScheme,
  SecurityScheme,
  ThymianHttpRequest,
  ThymianHttpResponse,
  ThymianNode,
  ThymianNodes,
} from './nodes.js';
import type {
  HttpLink,
  HttpTransaction,
  ThymianEdge,
  ThymianEdges,
} from './edges.js';

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface Parameter {
  description?: string;
  required: boolean;
  schema: ThymianSchema;
  style: SerializationStyle;
}

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

  addNode(node: ThymianNode, id: string = randomUUID()): string {
    try {
      this.graph.addNode(id, node);
    } catch (e) {
      console.log(e);
    }

    return id;
  }

  getNode(
    id: string
  ):
    | ThymianHttpRequest
    | ThymianHttpResponse
    | SecurityScheme
    | BasicSecurityScheme
    | BearerSecurityScheme
    | ApiKeySecurityScheme
    | ThymianNode
    | Nodes {
    return this.graph.getNodeAttributes(id);
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
}
