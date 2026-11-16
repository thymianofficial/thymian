import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Logger, ThymianFormatLocation } from '@thymian/core';

import { JsonLocDocument } from './json-loc-document.js';
import type { LocDocument, LocMapper } from './loc-mapper.js';
import { YamlLocDocument } from './yaml-loc-document.js';

/** Where a path item's operations live: a file and a pointer into it. */
type Target = { file: string; pointer: string[] };

function isJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe({ file, pointer }: Target): string {
  return `${file}#/${pointer.join('/')}`;
}

function unescapePointerSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Parses a `$ref` relative to the file that holds it. Returns the target, or
 * the reason the ref is not followed.
 */
function parseRef(ref: string, base: string): Target | string {
  const hashIndex = ref.indexOf('#');
  const location = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

  if (fragment !== '' && !fragment.startsWith('/')) {
    return `the ref "${ref}" does not use a JSON pointer`;
  }

  try {
    const pointer =
      fragment === ''
        ? []
        : fragment.slice(1).split('/').map(unescapePointerSegment);

    if (location === '') {
      return { file: base, pointer };
    }
    if (/^https?:/i.test(location)) {
      return `the remote ref "${ref}" is not fetched`;
    }
    if (/^file:/i.test(location)) {
      return { file: fileURLToPath(location), pointer };
    }
    // a scheme has at least two characters, so `C:\…` is still a path
    if (/^[a-z][a-z\d+.-]+:/i.test(location)) {
      return `the ref "${ref}" has an unsupported scheme`;
    }
    return {
      file: resolve(dirname(base), decodeURIComponent(location)),
      pointer,
    };
  } catch {
    return `the ref "${ref}" is malformed`;
  }
}

class RefFollowingLocMapper implements LocMapper {
  constructor(
    private readonly targets: Map<string, Target>,
    private readonly documents: Map<string, LocDocument | undefined>,
    private readonly logger: Logger,
  ) {}

  locationForOperation(
    pathTemplate: string,
    method: string,
  ): ThymianFormatLocation | undefined {
    const target = this.targets.get(pathTemplate);
    if (!target) {
      return undefined;
    }

    const position = this.documents
      .get(target.file)
      ?.keyPositionAt([...target.pointer, method]);
    if (!position) {
      this.logger.debug(
        `No source location for ${method} ${pathTemplate}: ${describe(target)} has no "${method}" key.`,
      );
      return undefined;
    }

    return { path: target.file, position };
  }
}

/**
 * Builds the loc mapper for an OpenAPI document on disk. Reads the root file
 * and every file its path items reference up front, so lookups stay
 * synchronous. Refs that cannot be followed leave their path item without a
 * location; the reason is logged at debug level.
 */
export async function locMapperForFile(
  path: string,
  logger: Logger,
): Promise<LocMapper> {
  const rootPath = resolve(path);
  const documents = new Map<string, LocDocument | undefined>();

  async function load(file: string): Promise<LocDocument | undefined> {
    if (!documents.has(file)) {
      try {
        const text = await readFile(file, 'utf-8');
        documents.set(
          file,
          isJson(text) ? new JsonLocDocument(text) : new YamlLocDocument(text),
        );
      } catch (e) {
        logger.debug(
          `Cannot read ${file} for source locations: ${e instanceof Error ? e.message : String(e)}`,
        );
        documents.set(file, undefined);
      }
    }
    return documents.get(file);
  }

  async function follow(
    pathTemplate: string,
    start: Target,
  ): Promise<Target | undefined> {
    const giveUp = (reason: string): undefined => {
      logger.debug(`No source location for ${pathTemplate}: ${reason}.`);
      return undefined;
    };

    const visited = new Set<string>();
    let current = start;
    for (;;) {
      const key = JSON.stringify([current.file, current.pointer]);
      if (visited.has(key)) {
        return giveUp(`the refs form a cycle at ${describe(current)}`);
      }
      visited.add(key);

      const document = await load(current.file);
      if (!document) {
        return giveUp(`${current.file} cannot be read or parsed`);
      }

      const value = document.valueAt(current.pointer);
      if (!isRecord(value)) {
        return giveUp(`${describe(current)} is not an object`);
      }
      // like the processor, follow the ref and ignore sibling keys
      if (typeof value['$ref'] !== 'string') {
        return current;
      }

      const next = parseRef(value['$ref'], current.file);
      if (typeof next === 'string') {
        return giveUp(next);
      }
      current = next;
    }
  }

  const targets = new Map<string, Target>();
  const paths = (await load(rootPath))?.valueAt(['paths']);
  if (isRecord(paths)) {
    for (const pathTemplate of Object.keys(paths)) {
      const target = await follow(pathTemplate, {
        file: rootPath,
        pointer: ['paths', pathTemplate],
      });
      if (target) {
        targets.set(pathTemplate, target);
      }
    }
  }

  return new RefFollowingLocMapper(targets, documents, logger);
}
