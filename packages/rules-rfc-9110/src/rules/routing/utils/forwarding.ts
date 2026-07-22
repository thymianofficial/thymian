import {
  type CapturedTrace,
  type CapturedTransaction,
  expandHttpParticipantRoles,
  type HttpParticipantRole,
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
 * commas inside parenthesised comments. Via entries may carry `(...)` comments
 * that themselves contain commas, so a naive `split(',')` would corrupt the
 * received-by tokens. Nested comments and quoted-pairs (`\)`) are handled.
 */
export function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '\\' && depth > 0) {
      // Quoted-pair inside a comment: keep the escaped pair verbatim so the
      // escaped character cannot be misread as a paren or comma.
      current += char + (value[i + 1] ?? '');
      i++;
      continue;
    }
    if (char === '(') {
      depth++;
    } else if (char === ')' && depth > 0) {
      depth--;
    }
    if (char === ',' && depth === 0) {
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
  const first = headerValues(value)[0];
  if (first === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(first.trim(), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
