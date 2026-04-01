import type {
  AfterEachResponseHook,
  AuthorizeHook,
  BeforeEachRequestHook,
} from '../hooks/hook-types.js';
import type { HttpRequestSample } from '../http-request-sample.js';

export type Hooks = {
  beforeEachRequest: BeforeEachRequestHook[];
  afterEachResponse: AfterEachResponseHook[];
  authorize: AuthorizeHook[];
};

export type BaseNode = {
  type: string;
  children: BaseNode[];
  hooks?: Hooks;
  value?: unknown;
  meta?: Record<PropertyKey, unknown>;
};

export type SampleStructureMeta = {
  version: string;
  timestamp: number;
};

export type SamplesStructure = BaseNode & {
  type: 'root';
  children: SourceNode[];
  meta: SampleStructureMeta;
};

export type SourceNode = BaseNode & {
  type: 'source';
  children: HostNode[];
  value: string;
};

export type HostNode = BaseNode & {
  type: 'host';
  value: string;
  children: PortNode[];
};

export type PortNode = BaseNode & {
  type: 'port';
  value: string;
  children: (PathNode | PathParameterNode | MethodNode)[];
};

export type PathNode = BaseNode & {
  type: 'path';
  value: string;
  children: (PathNode | PathParameterNode | MethodNode)[];
};

export type PathParameterNode = BaseNode & {
  type: 'pathParameter';
  value: string;
  children: (PathNode | PathParameterNode | MethodNode)[];
};

export type MethodNode = BaseNode & {
  type: 'method';
  value: string;
  children: (RequestMediaTypeNode | StatusCodeNode)[];
};

export type RequestMediaTypeNode = BaseNode & {
  type: 'requestMediaType';
  value: string;
  children: StatusCodeNode[];
};

export type StatusCodeNode = BaseNode & {
  type: 'statusCode';
  value: string;
  children: (ResponseMediaTypeNode | SamplesNode)[];
};

export type ResponseMediaTypeNode = BaseNode & {
  type: 'responseMediaType';
  value: string;
  children: SamplesNode[];
};

export type SamplingStrategy =
  | {
      type: 'random';
    }
  | {
      type: 'fixed';
      file: string;
    };

export type SamplesNodeMeta = {
  sourceTransaction: string;
  samplingStrategy: SamplingStrategy;
};

export type SamplesNode = BaseNode & {
  type: 'samples';
  meta: SamplesNodeMeta;
  children: RequestsNode[];
};

export type RequestsNode = BaseNode & {
  type: 'requests';
  value: HttpRequestSample[];
};

export type Node =
  | SamplesNode
  | StatusCodeNode
  | PathNode
  | MethodNode
  | HostNode
  | PortNode
  | PathParameterNode
  | RequestMediaTypeNode
  | SourceNode
  | ResponseMediaTypeNode
  | RequestsNode
  | SamplesStructure;

export type NodeTypes = {
  root: SamplesStructure;
  host: HostNode;
  port: PortNode;
  path: PathNode;
  pathParameter: PathParameterNode;
  method: MethodNode;
  requestMediaType: RequestMediaTypeNode;
  statusCode: StatusCodeNode;
  responseMediaType: ResponseMediaTypeNode;
  samples: SamplesNode;
  source: SourceNode;
  requests: RequestsNode;
};

export function nodeIsType<T extends Node['type']>(
  node: BaseNode,
  type: T,
): node is NodeTypes[T] {
  return node.type === type;
}

export function isValidNodeType(type: string): type is keyof NodeTypes {
  switch (type) {
    case 'root':
    case 'host':
    case 'port':
    case 'path':
    case 'pathParameter':
    case 'method':
    case 'requestMediaType':
    case 'statusCode':
    case 'responseMediaType':
    case 'samples':
    case 'requests':
    case 'source':
      return true;
    default:
      return false;
  }
}

export function isKnownNodeType(node: BaseNode): node is Node {
  return isValidNodeType(node.type);
}
