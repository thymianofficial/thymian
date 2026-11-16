import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Logger, ThymianFormatLocation } from '@thymian/core';

import { JsonLocDocument } from './json-loc-document.js';
import { formatRefTarget, parseRef, type RefTarget } from './json-ref.js';
import type { LocDocument, LocMapper } from './loc-mapper.js';
import { YamlLocDocument } from './yaml-loc-document.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A JSON document is also YAML, so JSON is tried first for its positions. */
function parseLocDocument(text: string): LocDocument {
  try {
    return new JsonLocDocument(text);
  } catch {
    return new YamlLocDocument(text);
  }
}

class RefFollowingLocMapper implements LocMapper {
  constructor(
    private readonly targets: Map<string, RefTarget>,
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
        `No source location for ${method} ${pathTemplate}: ${formatRefTarget(target)} has no "${method}" key.`,
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
        documents.set(file, parseLocDocument(text));
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
    start: RefTarget,
  ): Promise<RefTarget | undefined> {
    const giveUp = (reason: string): undefined => {
      logger.debug(`No source location for ${pathTemplate}: ${reason}.`);
      return undefined;
    };

    const visited = new Set<string>();
    let current = start;
    for (;;) {
      const key = JSON.stringify([current.file, current.pointer]);
      if (visited.has(key)) {
        return giveUp(`the refs form a cycle at ${formatRefTarget(current)}`);
      }
      visited.add(key);

      const document = await load(current.file);
      if (!document) {
        return giveUp(`${current.file} cannot be read or parsed`);
      }

      const value = document.valueAt(current.pointer);
      if (!isRecord(value)) {
        return giveUp(`${formatRefTarget(current)} is not an object`);
      }
      // like the processor, follow the ref and ignore sibling keys
      if (typeof value['$ref'] !== 'string') {
        return current;
      }

      const parsed = parseRef(value['$ref'], current.file);
      if ('reason' in parsed) {
        return giveUp(parsed.reason);
      }
      current = parsed.target;
    }
  }

  const targets = new Map<string, RefTarget>();
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
