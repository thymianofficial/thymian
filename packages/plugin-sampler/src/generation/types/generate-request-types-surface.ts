import type {
  Parameter,
  ThymianFormat,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '@thymian/core';
import CodeBlockWriter from 'code-block-writer';

import {
  generateTypeForSchema,
  infoText,
} from '../../hooks/generate-request-types.js';
import { type Selector, selectorPath } from '../../selectors/selector.js';
import { TransactionCatalog } from '../../selectors/transaction-catalog.js';
import { DeclarationSet } from './declaration-set.js';
import { reflectExamplesInPlace } from './example-reflection.js';
import {
  applyDefinitionNames,
  assignDefinitionNames,
  type DefinitionNameAssignment,
} from './schema-definitions.js';
import {
  assignUniqueNames,
  candidateName,
  compareStrings,
  NameRegistry,
  type SchemaRole,
} from './type-names.js';

/**
 * The v2 generated type surface: `Endpoints` keyed by fully-qualified
 * transaction selectors, the six spec-derived unions, and `Selector`.
 *
 * THERE IS EXACTLY ONE SELECTOR PRODUCER, AND IT IS NOT IN THIS DIRECTORY.
 * Every key comes verbatim from `TransactionCatalog`, which gets it from
 * `selectorForTransaction` / `formatSelector` — the only code path that renders
 * one, and one that self-checks its own output against the grammar. Nothing here
 * concatenates a method, a path, a media type and a status, because the whole
 * design rests on the committed keys and the runtime resolution being the same
 * strings BY CONSTRUCTION rather than by agreement. `parseSelector` is
 * diagnostics-only and is never called on this path.
 *
 * Two ordering decisions, different on purpose:
 *
 * - `Endpoints` is in `catalog.entries()` order and is NOT additionally sorted.
 *   That ordering is an explicit 575.2 decision whose docblock names this
 *   surface as its only dependant (`transaction-catalog.ts:76-84`); sorting here
 *   as well would make two orderings authoritative.
 * - The unions and the declarations ARE sorted, because they are sets, and a
 *   sorted set makes an additive spec change a one-line diff instead of a
 *   reshuffle.
 *
 * Nothing is written to disk and no command is wired to this: the file text is
 * returned, and 575.10 owns the artifact's name and location.
 */

/**
 * Every alias the surface declares itself, named once so the reservation and
 * the emission cannot drift.
 *
 * They are reserved in the name registry before anything else is assigned,
 * because a `components/schemas` entry called `Status` or `Selector` is
 * entirely ordinary and `plugin-openapi` hoists those names verbatim into root
 * `$defs`. Unreserved, such a schema emitted a second `Status` and the file did
 * not compile.
 */
const ALIAS = {
  endpoints: 'Endpoints',
  selector: 'Selector',
  method: 'Method',
  status: 'Status',
  statusClass: 'StatusClass',
  path: 'Path',
  requestMediaType: 'RequestMediaType',
  responseMediaType: 'ResponseMediaType',
} as const;

/**
 * The one way this module turns a string into TypeScript source.
 *
 * `code-block-writer`'s `quote()` escapes `"`, `\`, `\n` and `\r\n` but falls
 * through on a bare `\r`, which is a JS LineTerminator: one lone CR in a header
 * name or a media type — neither is constrained by the selector grammar — ended
 * the string literal mid-line and made the whole file unparseable. It also made
 * an emitted key and its matching union member two DIFFERENT texts, because the
 * unions already used `JSON.stringify`; AC3 and AC14 want them byte-identical,
 * so both sides come from here now.
 */
function stringLiteral(value: string): string {
  return JSON.stringify(value);
}

const QUERY_INDEX_SIGNATURE = '{ [query: string]: string | number | boolean }';
const PATH_INDEX_SIGNATURE = '{ [param: string]: string | number | boolean }';
const HEADER_INDEX_SIGNATURE =
  '{ [param: string]: string | string[] | undefined }';
const COOKIE_INDEX_SIGNATURE =
  '{ [cookie: string]: string | number | boolean }';

/**
 * Mirrors the v1 gate (`src/hooks/generate-request-types.ts:15-23`), which
 * `generateTypeForSchema` still applies internally and which stays exactly as
 * narrow as it was: anything that is not `application/json` or `*+json` is
 * `unknown`, not `any`, and no XML or binary schema work happens here.
 *
 * It has to be asked a second time, up front, because the example-reflection
 * pass compiles extra base declarations and a non-JSON body must not contribute
 * any. Note that the gate case-folds and strips parameters while the emitted key
 * and the media-type unions do not — intended: the gate decides WHETHER a schema
 * compiles, the selector decides WHAT the transaction is called.
 *
 * The duplication is deliberate and temporary: the v1 module is frozen for this
 * story, so the predicate cannot be extracted until 575.10 deletes it.
 */
function isJsonMediaType(mediaType: string): boolean {
  const normalized = mediaType.split(';', 1)[0]?.trim().toLowerCase();

  return (
    normalized === 'application/json' || normalized?.includes('+json') === true
  );
}

/**
 * The `content-type` header v1 synthesises from the media type
 * (`generate-request-types.ts:467-474`), kept so the emitted headers type still
 * carries the media type as a literal. Reproduced rather than imported because
 * v1 keeps it module-private and the v1 module is frozen.
 */
function mediaTypeParameter(mediaType: string): Parameter {
  return {
    schema: { type: 'string', const: mediaType },
    required: true,
    style: { style: 'simple', explode: false },
  };
}

function headersWithContentType(
  headers: Record<string, Parameter>,
  mediaType: string,
): Record<string, Parameter> {
  if (!mediaType) {
    return headers;
  }

  return { ...headers, 'content-type': mediaTypeParameter(mediaType) };
}

/** One schema the surface has to compile, and what to call the result. */
type SchemaSite = {
  readonly selector: Selector;
  readonly role: SchemaRole;
  readonly schema: unknown;
  /** Decides only whether the schema compiles — never how it is named. */
  readonly mediaType: string;
};

type ParameterRoleKind = Extract<SchemaRole, { parameter: string }>['kind'];

function roleKey(role: SchemaRole): string {
  return 'parameter' in role ? `${role.kind} ${role.parameter}` : role.kind;
}

function siteKey(selector: Selector, role: SchemaRole): string {
  return `${selector} ${roleKey(role)}`;
}

/**
 * Parameters in sorted name order. `Object.entries` order is already
 * reproducible for a given key set, so this is not about determinism across
 * runs — it is about the committed diff: sorted members mean a newly declared
 * parameter slots in instead of shifting every member after it.
 */
function sortedParameters(
  parameters: Record<string, Parameter>,
): (readonly [string, Parameter])[] {
  return Object.entries(parameters).sort(([a], [b]) => compareStrings(a, b));
}

function parameterMediaType(parameter: Parameter): string {
  return parameter.contentType ?? 'application/json';
}

function requestSites(
  selector: Selector,
  req: ThymianHttpRequest,
): SchemaSite[] {
  const sites: SchemaSite[] = [];

  if (req.body !== undefined) {
    sites.push({
      selector,
      role: { kind: 'request-body' },
      schema: req.body,
      mediaType: req.mediaType,
    });
  }

  const bags = [
    ['query-parameter', req.queryParameters],
    ['path-parameter', req.pathParameters],
    ['request-header', headersWithContentType(req.headers, req.mediaType)],
    ['cookie', req.cookies],
  ] as const;

  for (const [kind, parameters] of bags) {
    for (const [name, parameter] of sortedParameters(parameters)) {
      sites.push({
        selector,
        role: { kind, parameter: name },
        schema: parameter.schema,
        mediaType: parameterMediaType(parameter),
      });
    }
  }

  return sites;
}

function responseSites(
  selector: Selector,
  res: ThymianHttpResponse,
): SchemaSite[] {
  const sites: SchemaSite[] = [];

  if (res.schema !== undefined) {
    sites.push({
      selector,
      role: { kind: 'response-body' },
      schema: res.schema,
      mediaType: res.mediaType,
    });
  }

  for (const [name, parameter] of sortedParameters(
    headersWithContentType(res.headers, res.mediaType),
  )) {
    sites.push({
      selector,
      role: { kind: 'response-header', parameter: name },
      schema: parameter.schema,
      mediaType: parameterMediaType(parameter),
    });
  }

  return sites;
}

type CompiledSites = ReadonlyMap<string, string>;

async function compileSites(
  sites: readonly SchemaSite[],
  declarations: DeclarationSet,
  registry: NameRegistry,
): Promise<CompiledSites> {
  // Only the sites that will actually be compiled get a vote. A site whose
  // media type is not JSON short-circuits to `unknown` and contributes no
  // declaration at all, so letting its `$defs` take part in the naming produced
  // a surface containing `Pet_2` — a suffix meaning "a second, divergent
  // definition" — and no `Pet` for it to be second to.
  const definitionNames: DefinitionNameAssignment = assignDefinitionNames(
    sites
      .filter((site) => isJsonMediaType(site.mediaType))
      .map((site) => site.schema),
    registry,
  );
  const names = assignUniqueNames(
    sites.map((site) => ({
      key: siteKey(site.selector, site.role),
      candidate: candidateName(site.selector, site.role),
    })),
    registry,
  );
  const compiled = new Map<string, string>();

  for (const site of sites) {
    const key = siteKey(site.selector, site.role);
    const typeName = names.get(key);

    if (typeName === undefined || !isJsonMediaType(site.mediaType)) {
      compiled.set(key, 'unknown');
      continue;
    }

    const prepared: unknown = structuredClone(site.schema);

    applyDefinitionNames(prepared, definitionNames);

    declarations.addAll(
      await reflectExamplesInPlace(
        prepared,
        typeName,
        async (schema, name) => {
          const base = await generateTypeForSchema(
            schema,
            'application/json',
            name,
          );

          return base.declarations;
        },
        registry,
      ),
    );

    const generated = await generateTypeForSchema(
      prepared,
      site.mediaType,
      typeName,
    );

    declarations.addAll(generated.declarations);
    compiled.set(key, generated.type);
  }

  return compiled;
}

type ParameterBag = {
  readonly members: (readonly [string, string])[];
  readonly required: boolean;
};

function bagFor(
  selector: Selector,
  kind: ParameterRoleKind,
  parameters: Record<string, Parameter>,
  compiled: CompiledSites,
): ParameterBag {
  const members: (readonly [string, string])[] = [];
  let required = false;

  for (const [name, parameter] of sortedParameters(parameters)) {
    required ||= parameter.required;
    members.push([
      name,
      compiled.get(siteKey(selector, { kind, parameter: name })) ?? 'unknown',
    ]);
  }

  return { members, required };
}

/** Everything one `Endpoints` entry needs, resolved. */
type EndpointEntry = {
  readonly selector: Selector;
  readonly requestBody: string | undefined;
  readonly query: ParameterBag;
  readonly path: ParameterBag;
  readonly headers: ParameterBag;
  readonly cookies: ParameterBag;
  readonly statusCode: number;
  readonly responseHeaders: ParameterBag;
  readonly responseBody: string | undefined;
};

/**
 * The five RFC 9110 section 15 status classes and nothing else.
 *
 * The selector grammar carries NO status-range rule, so a status outside 100-599
 * is a representable selector and keeps both its `Endpoints` key and its
 * `Status` member: the selector was accepted, and dropping the key would break
 * the bijection the compiler's drift detection rests on. It contributes no
 * `StatusClass` member, because `StatusClass` is declared over the five classes
 * and 575.4 types a user-facing filter field on it, so admitting a `0xx` or
 * `10xx` token would put a non-RFC value into that filter.
 */
function statusClassOf(statusCode: number): string | undefined {
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    return undefined;
  }

  return `${Math.floor(statusCode / 100)}xx`;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function quotedMembers(values: Iterable<string>): string[] {
  return sortedUnique(values).map((value) => stringLiteral(value));
}

function writeBagLine(
  writer: CodeBlockWriter,
  field: string,
  bag: ParameterBag,
  indexSignature: string,
): void {
  writer.write(`${field}${bag.required ? '' : '?'}: `);

  if (bag.members.length === 0) {
    writer.write('{}');
  } else {
    writer.inlineBlock(() => {
      for (const [name, type] of bag.members) {
        writer.write(`${stringLiteral(name)}: ${type};`).newLine();
      }
    });
  }

  writer.write(` & ${indexSignature};`).newLine();
}

function writeEndpointEntry(
  writer: CodeBlockWriter,
  entry: EndpointEntry,
): void {
  writer
    .write(`${stringLiteral(entry.selector)}: `)
    .inlineBlock(() => {
      writer
        .write('req: ')
        .inlineBlock(() => {
          if (entry.requestBody !== undefined) {
            writer.write(`body: ${entry.requestBody};`).newLine();
          }

          writeBagLine(writer, 'query', entry.query, QUERY_INDEX_SIGNATURE);
          writeBagLine(writer, 'path', entry.path, PATH_INDEX_SIGNATURE);
          writeBagLine(
            writer,
            'headers',
            entry.headers,
            HEADER_INDEX_SIGNATURE,
          );
          writeBagLine(
            writer,
            'cookies',
            entry.cookies,
            COOKIE_INDEX_SIGNATURE,
          );
        })
        .write(';')
        .newLine()
        .write('res: ')
        .inlineBlock(() => {
          writer.write(`statusCode: ${entry.statusCode};`).newLine();
          writeBagLine(
            writer,
            'headers',
            entry.responseHeaders,
            HEADER_INDEX_SIGNATURE,
          );

          if (entry.responseBody !== undefined) {
            writer.write(`body: ${entry.responseBody};`).newLine();
          }
        })
        .write(';')
        .newLine();
    })
    .write(';')
    .newLine();
}

function writeEndpoints(
  writer: CodeBlockWriter,
  entries: readonly EndpointEntry[],
): void {
  writer.write(`export type ${ALIAS.endpoints} = `);

  if (entries.length === 0) {
    writer.write('{};').newLine();

    return;
  }

  writer
    .inlineBlock(() => {
      for (const entry of entries) {
        writeEndpointEntry(writer, entry);
      }
    })
    .write(';')
    .newLine();
}

/**
 * A closed union, or `never` for an empty axis.
 *
 * `never` and not `string`: a stale filter value has to be a `tsc` error, and
 * `string` silently disables the drift oracle for that axis. The alias is always
 * emitted, because a MISSING alias is an error at the filter's definition site
 * instead of at the user's hook.
 *
 * One member per line, so adding a status or a media type is a one-line diff in
 * the committed file.
 */
function writeUnion(
  writer: CodeBlockWriter,
  name: string,
  members: readonly string[],
): void {
  if (members.length === 0) {
    writer.write(`export type ${name} = never;`).newLine();

    return;
  }

  writer.write(`export type ${name} =`).newLine();
  writer.indent(() => {
    for (const [index, member] of members.entries()) {
      const last = index === members.length - 1;

      writer.write(`| ${member}${last ? ';' : ''}`).newLine();
    }
  });
}

/**
 * Generates the full `request-types.d.ts` text for a loaded format.
 *
 * Builds the catalog itself, and lets it throw. `formatSelector` rejects a path
 * carrying whitespace or the selector separator, a media type carrying a
 * parenthesis, and any rendering the grammar cannot read back, so ONE
 * unrepresentable transaction fails the whole generation. That is inherited
 * deliberately and must not be softened into a skip list, a soft-fail or a
 * try/catch: a partial `Endpoints` silently deletes a hook target, which is
 * strictly worse than an abort. A duplicate key is likewise the catalog's
 * `SelectorCollisionError`, not a second implementation here.
 *
 * Writes nothing; returns the text.
 */
export async function generateRequestTypesSurface(
  format: ThymianFormat,
): Promise<string> {
  const catalog = TransactionCatalog.fromThymianFormat(format);
  const sites: SchemaSite[] = [];

  for (const [selector, transaction] of catalog.entries()) {
    sites.push(
      ...requestSites(selector, transaction.thymianReq),
      ...responseSites(selector, transaction.thymianRes),
    );
  }

  const registry = new NameRegistry();

  registry.reserve(Object.values(ALIAS));

  const declarations = new DeclarationSet();
  const compiled = await compileSites(sites, declarations, registry);

  const entries: EndpointEntry[] = [];
  const methods = new Set<string>();
  const statuses = new Set<number>();
  const statusClasses = new Set<string>();
  const paths = new Set<string>();
  const requestMediaTypes = new Set<string>();
  const responseMediaTypes = new Set<string>();

  for (const [selector, transaction] of catalog.entries()) {
    const { thymianReq: req, thymianRes: res } = transaction;

    // Every union member has to be byte-identical to the substring the key
    // carries, or 575.4's filter can name a value that matches no key. Hence
    // `selectorPath` (the grammar anchors the path group on a slash, so a
    // slash-less `req.path` would not match its own key), the upper-cased method
    // (`formatSelector` upper-cases), and the media types verbatim.
    methods.add(req.method.toUpperCase());
    statuses.add(res.statusCode);
    paths.add(selectorPath(req.path));

    const statusClass = statusClassOf(res.statusCode);

    if (statusClass !== undefined) {
      statusClasses.add(statusClass);
    }

    // Gated on the media type being non-empty — NOT on a body or a schema
    // existing. `mediaType` is a non-optional string whose `''` means "none", so
    // a `content:` entry that declares a media type but no schema still gets its
    // own selector, and its media part still appears in the key. Testing body
    // presence instead would collapse two request content types for one method
    // and path onto a single entry, reintroducing the collision that
    // media-qualification exists to prevent.
    if (req.mediaType) {
      requestMediaTypes.add(req.mediaType);
    }

    if (res.mediaType) {
      responseMediaTypes.add(res.mediaType);
    }

    entries.push({
      selector,
      requestBody:
        req.body === undefined
          ? undefined
          : compiled.get(siteKey(selector, { kind: 'request-body' })),
      query: bagFor(selector, 'query-parameter', req.queryParameters, compiled),
      path: bagFor(selector, 'path-parameter', req.pathParameters, compiled),
      headers: bagFor(
        selector,
        'request-header',
        headersWithContentType(req.headers, req.mediaType),
        compiled,
      ),
      cookies: bagFor(selector, 'cookie', req.cookies, compiled),
      statusCode: res.statusCode,
      responseHeaders: bagFor(
        selector,
        'response-header',
        headersWithContentType(res.headers, res.mediaType),
        compiled,
      ),
      responseBody:
        res.schema === undefined
          ? undefined
          : compiled.get(siteKey(selector, { kind: 'response-body' })),
    });
  }

  const writer = new CodeBlockWriter({ indentNumberOfSpaces: 2 });

  writer.write(infoText.trim()).newLine().newLine();

  for (const declaration of declarations.toSortedArray()) {
    writer.write(declaration).newLine().newLine();
  }

  writeEndpoints(writer, entries);
  writer.newLine();

  // 575.2 left the runtime alias a documentation-only `Selector = string` and
  // deferred the typed union to the generated surface. 575.4's filter and
  // 575.6's hook targeting both consume it, so it is emitted here.
  writer
    .write(`export type ${ALIAS.selector} = keyof ${ALIAS.endpoints};`)
    .newLine()
    .newLine();

  writeUnion(writer, ALIAS.method, quotedMembers(methods));
  writer.newLine();
  writeUnion(
    writer,
    ALIAS.status,
    [...statuses].sort((a, b) => a - b).map((status) => String(status)),
  );
  writer.newLine();
  writeUnion(writer, ALIAS.statusClass, quotedMembers(statusClasses));
  writer.newLine();
  writeUnion(writer, ALIAS.path, quotedMembers(paths));
  writer.newLine();
  writeUnion(writer, ALIAS.requestMediaType, quotedMembers(requestMediaTypes));
  writer.newLine();
  writeUnion(
    writer,
    ALIAS.responseMediaType,
    quotedMembers(responseMediaTypes),
  );

  return writer.toString();
}
