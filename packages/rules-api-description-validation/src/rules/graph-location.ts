import {
  encodeMediaType,
  getContentType,
  type HttpResponse,
  isNodeType,
  type RuleFnResult,
  type RuleViolationLocation,
  type ThymianFormat,
  type ThymianHttpRequest,
} from '@thymian/core';

/** A location inside the format, as opposed to a recorded pair's label. */
export type GraphLocation = Exclude<RuleViolationLocation, string>;

/**
 * The request node a location names. An edge is a matched Transaction, so its
 * request; a node is the matched operation of an **Undocumented Response**
 * (ADR-0027), so the request node itself.
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

/**
 * A rule's result on a recorded pair whose operation the API description does
 * not know: a skip at the pair's label.
 */
export function unknownOperationSkip(
  location: string,
  title: string,
): RuleFnResult[] {
  return [
    {
      location,
      findings: [
        {
          title,
          kind: 'rule-skip',
          message: `No matching endpoint found in corresponding API description document.`,
        },
      ],
    },
  ];
}

/** The skip message of a response-scoped rule on an Undocumented Response. */
export function undocumentedResponseMessage(response: HttpResponse): string {
  const mediaType = getContentType(response.headers);
  const media = mediaType ? `(${encodeMediaType(mediaType)})` : '(none)';

  return `Skipped: the response ${response.statusCode} ${media} is not documented in the API specification.`;
}

/**
 * A response-scoped rule's result on an Undocumented Response: a skip naming
 * the response. The report already groups it under its operation.
 */
export function undocumentedResponseSkip(
  format: ThymianFormat,
  location: GraphLocation,
  response: HttpResponse,
  title: string,
): RuleFnResult[] {
  const hasRequest = requestAt(format, location) !== undefined;

  return [
    {
      location,
      findings: [
        {
          title,
          kind: 'rule-skip',
          message: hasRequest
            ? undocumentedResponseMessage(response)
            : missingElementMessage(location),
        },
      ],
    },
  ];
}
