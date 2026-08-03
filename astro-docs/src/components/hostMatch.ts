/**
 * True when `host` is exactly `domain` or a real subdomain of it (`sub.domain`).
 * The leading-dot check is deliberate: a bare `host.endsWith(domain)` would also
 * match an attacker-controlled `evildomain.com` (it "ends with" the domain
 * without the dot boundary) — the incomplete-URL-sanitization pitfall. Shared by
 * `events/eventMeta.ts` and `resources/resourceMeta.ts` so both derive their host
 * decisions from ONE secure implementation.
 */
export function isHost(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}
