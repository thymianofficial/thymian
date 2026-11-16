import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where a path item's operations live: a file and a pointer into it. */
export type RefTarget = { file: string; pointer: string[] };

export type ParsedRef = { target: RefTarget } | { reason: string };

export function formatRefTarget({ file, pointer }: RefTarget): string {
  return `${file}#/${pointer.join('/')}`;
}

function unescapePointerSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Parses a `$ref` relative to the file that holds it. Gives the target, or
 * the reason the ref is not followed.
 */
export function parseRef(ref: string, base: string): ParsedRef {
  const hashIndex = ref.indexOf('#');
  const location = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

  if (fragment !== '' && !fragment.startsWith('/')) {
    return { reason: `the ref "${ref}" does not use a JSON pointer` };
  }

  try {
    const pointer =
      fragment === ''
        ? []
        : fragment.slice(1).split('/').map(unescapePointerSegment);

    if (location === '') {
      return { target: { file: base, pointer } };
    }
    if (/^https?:/i.test(location)) {
      return { reason: `the remote ref "${ref}" is not fetched` };
    }
    if (/^file:/i.test(location)) {
      return { target: { file: fileURLToPath(location), pointer } };
    }
    // a scheme has at least two characters, so `C:\…` is still a path
    if (/^[a-z][a-z\d+.-]+:/i.test(location)) {
      return { reason: `the ref "${ref}" has an unsupported scheme` };
    }
    return {
      target: {
        file: resolve(dirname(base), decodeURIComponent(location)),
        pointer,
      },
    };
  } catch {
    return { reason: `the ref "${ref}" is malformed` };
  }
}
