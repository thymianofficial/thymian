import {
  encodeMediaType,
  getContentType,
  type HttpResponse,
  isNodeType,
  type RuleFnResult,
  type RuleViolationLocation,
  type ThymianFormat,
  type ThymianHttpRequest,
  thymianRequestToString,
} from '@thymian/core';

/** A location inside the format, as opposed to a recorded pair's label. */
export type GraphLocation = Exclude<RuleViolationLocation, string>;

/**
 * The request node a location names. An edge is a matched Transaction, so its
 * request; a node is the matched operation of an **Undocumented Response**
 * (ADR-0026), so the request node itself.
 */
export function requestAt(
  format: ThymianFormat,
  location: GraphLocation,
): ThymianHttpRequest | undefined {
  if (location.elementType === 'edge') {
    return format.getThymianHttpTransactionById(location.elementId)?.thymianReq;
  }

  const node = format.graph.hasNode(location.elementId)
    ? format.getNode(location.elementId)
    : undefined;

  return node && isNodeType(node, 'http-request') ? node : undefined;
}

export function missingElementMessage(location: GraphLocation): string {
  const element = location.elementType === 'edge' ? 'transaction' : 'request';

  return `Can't find ${element} with given ID ${location.elementId} in Thymian format.`;
}

/** The skip message of a response-scoped rule on an Undocumented Response. */
export function undocumentedResponseMessage(
  response: HttpResponse,
  operation: ThymianHttpRequest,
): string {
  const mediaType = getContentType(response.headers);
  const media = mediaType ? ` (${encodeMediaType(mediaType)})` : '';

  return `Skipped: the response ${response.statusCode}${media} is not documented in the API specification for ${thymianRequestToString(operation)}.`;
}

/**
 * A response-scoped rule's result on an Undocumented Response: a skip naming
 * the response and its operation.
 */
export function undocumentedResponseSkip(
  format: ThymianFormat,
  location: GraphLocation,
  response: HttpResponse,
  title: string,
): RuleFnResult[] {
  const operation = requestAt(format, location);

  return [
    {
      location,
      findings: [
        {
          title,
          kind: 'rule-skip',
          message: operation
            ? undocumentedResponseMessage(response, operation)
            : missingElementMessage(location),
        },
      ],
    },
  ];
}
