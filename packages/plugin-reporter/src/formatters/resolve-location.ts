/**
 * Location resolution used to be duplicated here, in
 * `common-cli/src/cli-report-renderer.ts`, and (partially — it never resolved
 * `thymianFormat` locations at all) in `csv.ts`, and the copies had already
 * drifted from one another (BaggersIO PR-311 finding 5). The implementation
 * now lives in `@thymian/core` (`report/location-format.ts`) as the single
 * source of truth; this module re-exports it under its established local name
 * so existing imports keep working.
 */
export { createLocationResolver, type LocationResolver } from '@thymian/core';
