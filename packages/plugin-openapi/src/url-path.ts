/**
 * Joins the base path of a server URL with an OpenAPI path template.
 *
 * Both operands are URL path segments: `basePath` comes from the `pathname` of
 * a server URL (see `extractServerInfo`) and `path` is a key of the OpenAPI
 * `paths` object. `node:path`'s `join` must never be used for this — its
 * separator is platform dependent, so it produces `\v1\pets` on Windows, and it
 * resolves `.` and `..` segments, which silently rewrites a path template into
 * a different operation.
 *
 * Semantics:
 * - Exactly one `/` separates the two operands, and any run of slashes in the
 *   result collapses to a single one, so a trailing slash on `basePath` and a
 *   leading slash on `path` do not double up.
 * - The result is always rooted: an empty `basePath` means "the server root",
 *   so `('', 'pets')` yields `/pets`.
 * - A trailing slash on `path` is preserved — `/pets` and `/pets/` are
 *   different resources.
 * - `.` and `..` segments are passed through verbatim. A path template is an
 *   operation identity, not a file location, and resolving them would change
 *   which operation a selector or filter names.
 */
export function joinUrlPath(basePath: string, path: string): string {
  return `${basePath}/${path}`.replace(/\/{2,}/g, '/');
}
