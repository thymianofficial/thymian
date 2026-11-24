import { Buffer } from 'node:buffer';

import {
  type CapturedTrace,
  type CapturedTransaction,
  expandHttpParticipantRoles,
  getHeader,
  type HttpParticipantRole,
  type HttpResponse,
} from '@thymian/core';

type HeaderValue = string | string[] | undefined;

export type ForwardingHop = {
  /**
   * Transaction on the user-agent side of the forwarding participant
   * (`trace[i - 1]`): its request is the message the participant received,
   * its response is the message the participant sent back downstream.
   */
  inbound: CapturedTransaction;
  /**
   * Transaction on the origin side of the forwarding participant
   * (`trace[i]`): its request is the message the participant forwarded
   * onward, its response is the message it received from upstream.
   */
  outbound: CapturedTransaction;
};

/**
 * Pairs adjacent transactions of a captured trace into forwarding hops.
 *
 * Captured traces are ordered root-first (see `sortTraceTransactions` in
 * plugin-http-analyzer): `trace[0]` is the transaction observed at the edge,
 * closest to the user agent, and each later entry is the onward transaction
 * produced by the forwarding participant between it and its predecessor.
 * Because `meta.role` names the participant that produced a message, that
 * middle participant is identified by `outbound.request.meta.role` (it sent
 * the onward request) or `inbound.response.meta.role` (it sent the downstream
 * response).
 *
 * Only hops whose middle participant matches one of the given roles are
 * returned; umbrella roles are expanded, so the default `['intermediary']`
 * also matches concrete `proxy`, `gateway` and `tunnel` stamps. Traces with
 * fewer than two transactions (e.g. single-transaction HAR imports) yield no
 * hops.
 */
export function forwardingHops(
  trace: CapturedTrace,
  roles: readonly HttpParticipantRole[] = ['intermediary'],
): ForwardingHop[] {
  const accepted = new Set(expandHttpParticipantRoles(roles));
  const matches = (role: HttpParticipantRole | undefined): boolean =>
    role !== undefined && accepted.has(role);

  const hops: ForwardingHop[] = [];
  for (let i = 1; i < trace.length; i++) {
    const inbound = trace[i - 1];
    const outbound = trace[i];
    if (!inbound || !outbound) {
      continue;
    }
    if (
      matches(outbound.request.meta.role) ||
      matches(inbound.response.meta.role)
    ) {
      hops.push({ inbound, outbound });
    }
  }
  return hops;
}

export function headerValues(value: HeaderValue): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Splits a comma-separated header value on top-level commas only, ignoring
 * commas inside parenthesised comments and inside quoted strings. Via entries
 * may carry `(...)` comments, and Cache-Control directive arguments may be
 * quoted strings (`private="a, b"`), that themselves contain commas, so a
 * naive `split(',')` would corrupt the list members. Nested comments and
 * quoted-pairs (`\)`, `\"`) are handled. A `"` opens a quoted string only
 * outside a comment, since a comment's text may contain one; an unterminated
 * quoted string runs to the end of the value.
 */
export function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '\\' && (depth > 0 || quoted)) {
      // Quoted-pair inside a comment or quoted string: keep the escaped pair
      // verbatim so the escaped character cannot be misread as a delimiter.
      current += char + (value[i + 1] ?? '');
      i++;
      continue;
    }
    if (quoted) {
      if (char === '"') {
        quoted = false;
      }
    } else if (char === '"' && depth === 0) {
      quoted = true;
    } else if (char === '(') {
      depth++;
    } else if (char === ')' && depth > 0) {
      depth--;
    }
    if (char === ',' && depth === 0 && !quoted) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

export function equalHeaderValues(a: HeaderValue, b: HeaderValue): boolean {
  const normalize = (value: HeaderValue): string[] =>
    headerValues(value)
      .map((entry) => entry.trim())
      .sort();
  const left = normalize(a);
  const right = normalize(b);
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

export function connectionOptionNames(value: HeaderValue): string[] {
  return headerValues(value)
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function parseMaxForwards(value: HeaderValue): number | undefined {
  // Max-Forwards is 1*DIGIT (RFC 9110 Section 7.6.2). Number.parseInt would
  // leniently accept partial/invalid input ("5abc" -> 5, "5, 6" -> 5,
  // "-1" -> -1), so require the trimmed token to be an unsigned integer first.
  const first = headerValues(value)[0]?.trim();
  if (first === undefined || !/^\d+$/.test(first)) {
    return undefined;
  }
  return Number.parseInt(first, 10);
}

/**
 * Whether the Cache-Control field of the given header map carries the
 * `no-transform` directive (RFC 9111 Section 5.2), wherever it sits in a
 * comma-separated value, in any letter case.
 */
export function hasNoTransformDirective(
  headers: Record<string, HeaderValue>,
): boolean {
  return headerValues(getHeader(headers, 'cache-control'))
    .flatMap((entry) => splitTopLevelCommas(entry))
    .some((directive) => directive.trim().toLowerCase() === 'no-transform');
}

type CapturedContent = Pick<HttpResponse, 'body' | 'bodyEncoding'>;

export type ContentComparison = 'same' | 'different' | 'undeterminable';

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * The bytes a captured body stands for, or `undefined` when they cannot be
 * known: the body was not captured (a Capture Gap), its `bodyEncoding` is
 * not one this helper decodes, or it is not valid base64.
 */
function decodeContent({
  body,
  bodyEncoding,
}: CapturedContent): Buffer | undefined {
  if (body === undefined) {
    return undefined;
  }
  if (bodyEncoding === undefined) {
    return Buffer.from(body, 'utf8');
  }
  // Buffer.from is lenient and silently drops characters outside the base64
  // alphabet, so a malformed body is rejected rather than decoded by guesswork.
  if (bodyEncoding.toLowerCase() === 'base64' && BASE64.test(body)) {
    return Buffer.from(body, 'base64');
  }
  return undefined;
}

/**
 * Compares the content a forwarding participant received with the content it
 * forwarded, byte for byte after decoding each body per its `bodyEncoding`
 * (`base64`, or UTF-8 text when absent). Yields `undeterminable` when either
 * side's bytes cannot be known, so rules skip the hop rather than guess.
 */
export function compareContent(
  received: CapturedContent,
  forwarded: CapturedContent,
): ContentComparison {
  const before = decodeContent(received);
  const after = decodeContent(forwarded);
  if (before === undefined || after === undefined) {
    return 'undeterminable';
  }
  return before.equals(after) ? 'same' : 'different';
}
