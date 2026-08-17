/**
 * `@thymian/common-http-fields` — shared HTTP field primitives for Thymian rule sets.
 *
 * Scope of this package is deliberately narrow: it holds **pure logic** that more than one
 * `rules-*` package reads through, and nothing else.
 *
 * - The normalized header view every rule reads through, so `lint`, `test` and `analyze` agree on
 *   case-folding and on same-name multiplicity.
 * - The natively-Structured-Fields header registry, and the guard that **refuses** RFC 9651 parsing
 *   for fields that never opted into the mechanism (`Content-Security-Policy`, `Set-Cookie`, …).
 *
 * Single-consumer reference data is **not** a shared utility and does not live here: the Public
 * Suffix List snapshot stays vendored in `@thymian/rules-cookies`, the OWASP Secure Headers Project
 * JSON in `@thymian/rules-secure-headers`. Promotion to this package is triggered by a second
 * consumer, never by anticipation.
 *
 * This module is intentionally empty at scaffold time; the view lands with the normalized-header
 * story and the registry/guard with the Structured-Fields story.
 */

export {};
