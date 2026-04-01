import { URL } from 'node:url';

import {
  type ThymianHttpTransaction,
  thymianRequestToOrigin,
} from '@thymian/core';

import type { HttpRequestSample } from '../http-request-sample.js';
import { sanitize } from '../utils.js';
import type {
  HostNode,
  MethodNode,
  PathNode,
  PathParameterNode,
  PortNode,
  RequestMediaTypeNode,
  RequestsNode,
  ResponseMediaTypeNode,
  SamplesStructure,
  SourceNode,
  StatusCodeNode,
} from './samples-tree-structure.js';

export function samplesTreeFromThymianHttpTransaction(
  sample: HttpRequestSample,
  transaction: ThymianHttpTransaction,
  version: string,
): SamplesStructure {
  const tree: SamplesStructure = {
    type: 'root',
    children: [],
    meta: {
      version,
      timestamp: Date.now(),
    },
  };

  const url = new URL(thymianRequestToOrigin(transaction.thymianReq));
  const host = sanitize(url.hostname);

  const sourceNode: SourceNode = {
    children: [],
    type: 'source',
    value: transaction.transaction.sourceName,
  };
  tree.children.push(sourceNode);

  const hostNode: HostNode = {
    type: 'host',
    value: host,
    children: [],
  };
  sourceNode.children.push(hostNode);

  const portNode: PortNode = {
    type: 'port',
    value: url.port,
    children: [],
  };
  hostNode.children.push(portNode);

  const nextNode = transaction.thymianReq.path
    .split('/')
    .filter((s) => s.length > 0)
    .reduce((prev: PortNode | PathNode | PathParameterNode, path: string) => {
      if (/^\{.*}$/.test(path)) {
        const pathParameterNode: PathParameterNode = {
          type: 'pathParameter',
          value: path.substring(1, path.length - 1),
          children: [],
        };
        prev.children.push(pathParameterNode);
        return pathParameterNode;
      } else {
        const pathNode: PathNode = {
          type: 'path',
          value: path,
          children: [],
        };
        prev.children.push(pathNode);
        return pathNode;
      }
    }, portNode);

  const methodNode: MethodNode = {
    type: 'method',
    value: transaction.thymianReq.method.toLowerCase(),
    children: [],
  };
  nextNode.children.push(methodNode);

  let maybeReqMediaTypeNode: RequestMediaTypeNode | undefined;

  if (transaction.thymianReq.mediaType) {
    maybeReqMediaTypeNode = {
      type: 'requestMediaType',
      value: transaction.thymianReq.mediaType,
      children: [],
    };
    methodNode.children.push(maybeReqMediaTypeNode);
  }

  const statusCodeNode: StatusCodeNode = {
    type: 'statusCode',
    value: transaction.thymianRes.statusCode.toString(),
    children: [],
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  maybeReqMediaTypeNode
    ? maybeReqMediaTypeNode.children.push(statusCodeNode)
    : methodNode.children.push(statusCodeNode);

  let maybeResMediaTypeNode: ResponseMediaTypeNode | undefined;

  if (transaction.thymianRes.mediaType) {
    maybeResMediaTypeNode = {
      type: 'responseMediaType',
      value: transaction.thymianRes.mediaType,
      children: [],
    };
    statusCodeNode.children.push(maybeResMediaTypeNode);
  }

  const requestsNode: RequestsNode = {
    children: [],
    type: 'requests',
    value: [sample],
  };

  if (maybeResMediaTypeNode) {
    maybeResMediaTypeNode.children.push({
      type: 'samples',
      meta: {
        sourceTransaction: transaction.transactionId,
        samplingStrategy: {
          type: 'random',
        },
      },
      children: [requestsNode],
    });
  } else {
    statusCodeNode.children.push({
      type: 'samples',
      meta: {
        sourceTransaction: transaction.transactionId,
        samplingStrategy: {
          type: 'random',
        },
      },
      children: [requestsNode],
    });
  }

  return tree;
}
