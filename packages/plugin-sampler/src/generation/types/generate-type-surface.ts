import type { Parameter } from '@thymian/core';

import type { TransactionCatalog } from '../../selectors/transaction-catalog.js';
import { PATH_GLOB_SOURCE } from '../../selectors/transaction-filter.js';
import { generateSchemaType, isJsonMediaType } from './schema-type.js';
import { NameRegistry } from './type-names.js';

/** The two files the committed surface consists of. */
export type TypeSurface = {
  /** `Endpoints`, the spec-derived unions, and the schema declarations. */
  requestTypes: string;
  /** The `@thymian/hooks` authoring surface, typed against `Endpoints`. */
  hooksApi: string;
};

export const REQUEST_TYPES_FILE = 'request-types.d.ts';
export const HOOKS_API_FILE = 'hooks-api.d.ts';

const BANNER = `/*
 * ========================================================================
 *
 * WARNING: THIS FILE IS GENERATED. DO NOT EDIT.
 *
 * Regenerate it with \`thymian sampler sync\`, and commit the result: these
 * types are the baseline the drift gate compares against, so an edit here is
 * indistinguishable from the API description having changed.
 *
 * ========================================================================
 */
`;

/**
 * The specifier one generated declaration file imports another by.
 *
 * A `.d.ts` file is imported by the module path it *declares* — `./x.js` — not
 * by its own filename. Emitting `./x.d.ts` happened to resolve under the
 * scaffolded tsconfig, which is exactly why it was worth fixing before some
 * other configuration stopped tolerating it.
 */
function moduleSpecifierFor(declarationFile: string): string {
  return declarationFile.replace(/\.d\.ts$/, '.js');
}

/** A union type text, sorted so the emission does not depend on visit order. */
function union(values: Iterable<string>): string {
  const sorted = [...new Set(values)].sort();

  return sorted.length === 0 ? 'never' : sorted.join(' | ');
}

function quote(value: string): string {
  return JSON.stringify(value);
}

/**
 * Every parameter of one group as one type literal, plus an open index
 * signature so a hook can still set a header the description never mentioned.
 */
async function parametersType(
  parameters: Record<string, Parameter>,
  indexSignature: string,
  nameFor: (parameter: string) => string,
  declarations: string[],
): Promise<string> {
  const entries: string[] = [];

  for (const name of Object.keys(parameters).sort()) {
    const parameter = parameters[name] as Parameter;
    const generated = await generateSchemaType(
      parameter.schema,
      parameter.contentType ?? 'application/json',
      nameFor(name),
    );

    declarations.push(...generated.declarations);
    entries.push(
      `    ${quote(name)}${parameter.required ? '' : '?'}: ${generated.type};`,
    );
  }

  return [`{`, ...entries, `    ${indexSignature}`, `  }`].join('\n');
}

/**
 * Emit the committed type surface for a loaded description.
 *
 * Deterministic by construction: unions are sorted, parameters are emitted in
 * name order, declaration names come from the selector and the schema's role
 * within the transaction (see `type-names.ts`), and `Endpoints` follows catalog
 * order — which is sorted by selector. So reordering the source document, or
 * renaming its title, changes nothing here; and because no name is positional,
 * inserting an endpoint touches only the lines that endpoint owns plus the
 * unions its method, status, path and media types widen.
 */
export async function generateTypeSurface(
  catalog: TransactionCatalog,
): Promise<TypeSurface> {
  const declarations: string[] = [];
  const endpoints: string[] = [];
  const methods = new Set<string>();
  const statuses = new Set<string>();
  const statusClasses = new Set<string>();
  const paths = new Set<string>();
  const requestMediaTypes = new Set<string>();
  const responseMediaTypes = new Set<string>();
  // The fixed declarations this file emits around the generated ones, so a
  // generated name can never shadow one of them.
  const names = new NameRegistry([
    'Endpoints',
    'Method',
    'Path',
    'RequestMediaType',
    'ResponseMediaType',
    'Selector',
    'Status',
    'StatusClass',
  ]);

  for (const [selector, transaction] of catalog.entries()) {
    const { thymianReq: req, thymianRes: res } = transaction;

    methods.add(req.method.toUpperCase());
    statuses.add(String(res.statusCode));
    paths.add(req.path);

    // A status class is the first digit, so a description declaring a 418 or a
    // vendor's 499 gets a "4XX" it can actually target.
    const firstDigit = String(res.statusCode)[0];

    if (firstDigit && /[1-5]/.test(firstDigit)) {
      statusClasses.add(`${firstDigit}XX`);
    }

    if (req.mediaType) {
      requestMediaTypes.add(req.mediaType);
    }

    if (res.mediaType) {
      responseMediaTypes.add(res.mediaType);
    }

    const requestBody = await generateSchemaType(
      req.body,
      req.mediaType,
      names.nameFor(selector, { kind: 'request-body' }),
    );
    const responseBody = await generateSchemaType(
      res.schema,
      res.mediaType,
      names.nameFor(selector, { kind: 'response-body' }),
    );

    declarations.push(
      ...requestBody.declarations,
      ...responseBody.declarations,
    );

    const query = await parametersType(
      req.queryParameters,
      '[query: string]: unknown;',
      (parameter) =>
        names.nameFor(selector, { kind: 'query-parameter', parameter }),
      declarations,
    );
    const path = await parametersType(
      req.pathParameters,
      '[param: string]: unknown;',
      (parameter) =>
        names.nameFor(selector, { kind: 'path-parameter', parameter }),
      declarations,
    );
    const headers = await parametersType(
      req.headers,
      '[header: string]: string | string[] | undefined;',
      (parameter) =>
        names.nameFor(selector, { kind: 'request-header', parameter }),
      declarations,
    );
    const cookies = await parametersType(
      req.cookies,
      '[cookie: string]: unknown;',
      (parameter) => names.nameFor(selector, { kind: 'cookie', parameter }),
      declarations,
    );
    const responseHeaders = await parametersType(
      res.headers,
      '[header: string]: string | string[] | undefined;',
      (parameter) =>
        names.nameFor(selector, { kind: 'response-header', parameter }),
      declarations,
    );

    endpoints.push(
      [
        `  ${quote(selector)}: {`,
        // The description's own casing, which is what a hook actually sees.
        // The uppercase form is the Selector's and the `Method` union's.
        `    method: ${quote(req.method)};`,
        `    path: ${quote(req.path)};`,
        `    status: ${res.statusCode};`,
        `    requestMediaType: ${quote(req.mediaType)};`,
        `    responseMediaType: ${quote(res.mediaType)};`,
        `    authorize: boolean;`,
        `    req: {`,
        `      body${isJsonMediaType(req.mediaType) && req.body ? (req.bodyRequired ? '' : '?') : '?'}: ${requestBody.type};`,
        `      query?: ${query};`,
        `      path?: ${path};`,
        `      headers?: ${headers};`,
        `      cookies?: ${cookies};`,
        `    };`,
        `    res: {`,
        `      statusCode: ${res.statusCode};`,
        `      headers: ${responseHeaders};`,
        `      body: ${responseBody.type};`,
        `    };`,
        `  };`,
      ].join('\n'),
    );
  }

  const requestTypes = [
    BANNER,
    ...[...new Set(declarations)].sort(),
    '',
    '/** Every HTTP method the description uses. */',
    `export type Method = ${union([...methods].map(quote))};`,
    '',
    '/** Every status code the description declares. */',
    `export type Status = ${union(statuses)};`,
    '',
    '/** Every status class the declared statuses fall into. */',
    `export type StatusClass = ${union([...statusClasses].map(quote))};`,
    '',
    '/** Every path template the description declares, base path included. */',
    `export type Path = ${union([...paths].map(quote))};`,
    '',
    '/** Every media type a request node declares. */',
    `export type RequestMediaType = ${union([...requestMediaTypes].map(quote))};`,
    '',
    '/** Every media type a response node declares. */',
    `export type ResponseMediaType = ${union([...responseMediaTypes].map(quote))};`,
    '',
    '/**',
    ' * Every Transaction the description declares, keyed by its Selector.',
    ' *',
    ' * One key is exactly one Transaction, so a key carries its own status and',
    ' * media types and there is no union of responses to narrow.',
    ' */',
    'export type Endpoints = {',
    ...endpoints,
    '};',
    '',
    '/** The address of exactly one Transaction. */',
    'export type Selector = keyof Endpoints;',
    '',
  ].join('\n');

  return { requestTypes, hooksApi: hooksApiSource() };
}

/**
 * The `@thymian/hooks` surface, as a declaration file.
 *
 * Written as text rather than generated from the runtime module because it is a
 * *contract*: the runtime resolves through a jiti alias and never reads this
 * file, so what is committed here is what the author's editor sees, and it has
 * to say what the author is allowed to write — not what the implementation
 * happens to accept.
 */
function hooksApiSource(): string {
  return `${BANNER}
import type {
  Endpoints,
  Method,
  Path,
  RequestMediaType,
  ResponseMediaType,
  Selector,
  Status,
  StatusClass,
} from './${moduleSpecifierFor(REQUEST_TYPES_FILE)}';

export type {
  Endpoints,
  Method,
  Path,
  RequestMediaType,
  ResponseMediaType,
  Selector,
  Status,
  StatusClass,
};

/**
 * A path glob, by shape: at least one \`*\`.
 *
 * A string with no \`*\` is not a \`PathGlob\`, so it has to be an exact \`Path\` —
 * which is what keeps a typo'd exact path a compile error while a glob stays a
 * plain string. The shape deliberately never touches the \`Path\` union;
 * vacuousness is reported by \`sampler validate\` and fails a run at load.
 *
 * \`*\` is exactly one path segment and a trailing \`**\` is one or more, so
 * \`/admin/**\` is everything *under* \`/admin\` and not \`/admin\` itself.
 */
export type PathGlob = ${PATH_GLOB_SOURCE};

/** The fields a filter can constrain. Each value is spec-derived and closed. */
export type FilterFields = {
  readonly method?: Method | readonly Method[];
  readonly status?: Status | readonly Status[];
  readonly statusClass?: StatusClass | readonly StatusClass[];
  readonly path?: Path | PathGlob | readonly (Path | PathGlob)[];
  readonly requestMediaType?: RequestMediaType | readonly RequestMediaType[];
  readonly responseMediaType?: ResponseMediaType | readonly ResponseMediaType[];
};

/**
 * Targets a set of Transactions.
 *
 * Fields AND-combine; an array within a field OR-combines. \`not\` excludes, one
 * level deep by construction.
 */
export type TransactionFilter = FilterFields & {
  readonly not?: FilterFields | readonly FilterFields[];
};

/** What a per-transaction hook is aimed at. */
export type HookTarget = Selector | readonly Selector[] | TransactionFilter;

/** One parameter group of a Transaction's request, as a hook sees it. */
type GroupOf<
  T extends Selector,
  K extends 'query' | 'path' | 'headers' | 'cookies',
> = NonNullable<Endpoints[T]['req'][K]>;

/**
 * The request a hook shapes, for a target that names exactly one Transaction.
 *
 * Built field by field rather than by intersecting \`Endpoints[T]['req']\`. That
 * intersection was wrong in a way the compiler could not warn about: \`req.path\`
 * is the *path-parameter group*, while the live request's \`path\` is the URL
 * template — so \`path\` came out as an object type intersected with a string
 * literal. Assigning the template was a false compile error, and
 * \`request.path.id = …\` compiled and then threw at run time.
 */
export type RequestOf<T> = T extends Selector
  ? {
      /**
       * The method as the description spells it, casing included — which for an
       * OpenAPI document is the lowercase path-item key. The uppercase form
       * lives in \`Method\` and in Selectors, where it is canonical.
       */
      method: Endpoints[T]['method'];
      /** The path template, with its \`{param}\` placeholders intact. */
      path: Endpoints[T]['path'];
      origin: string;
      authorize: boolean;
      bodyEncoding?: string;
      pathParameters: GroupOf<T, 'path'>;
      query: GroupOf<T, 'query'>;
      headers: GroupOf<T, 'headers'>;
      cookies: GroupOf<T, 'cookies'>;
    } & BodyOf<T>
  : GenericRequest;

/**
 * The body field, required exactly when the Transaction requires a body.
 *
 * Declaring it optional unconditionally made the documented mutate-in-place
 * idiom need a non-null assertion — \`draft.body!.rank = …\` — on every
 * body-touching hook, for a body the description says is always there. An
 * optional property does not satisfy a required one, so the check below lands
 * on the right branch by itself.
 */
type BodyOf<T extends Selector> = Endpoints[T]['req'] extends { body: infer B }
  ? { body: B }
  : { body?: Endpoints[T]['req']['body'] };

/** The request a hook shapes when its target covers more than one Transaction. */
export type GenericRequest = {
  method: string;
  path: Path;
  origin: string;
  authorize: boolean;
  bodyEncoding?: string;
  query: Record<string, unknown>;
  pathParameters: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  cookies: Record<string, unknown>;
  body?: unknown;
};

/**
 * What a cross-endpoint call may pass for one Transaction.
 *
 * Every parameter group is a \`Partial\`, because the call **overlays** the
 * generated request: what you leave out comes from the description. A body is
 * *replaced* rather than merged, so it is the whole body type — optional,
 * because the generated one already satisfies the schema.
 *
 * Requiring the full \`req\` here made the documented seeding idiom —
 * \`utils.request(selector, {}, { authorize: true })\` — a compile error for
 * every operation with a required body, which is the only kind anyone seeds
 * with.
 */
export type RequestArgsOf<T extends Selector> = {
  body?: Endpoints[T]['req']['body'];
  query?: Partial<GroupOf<T, 'query'>>;
  path?: Partial<GroupOf<T, 'path'>>;
  headers?: Partial<GroupOf<T, 'headers'>>;
  cookies?: Partial<GroupOf<T, 'cookies'>>;
};

/** The response a hook observes. */
export type ResponseOf<T> = T extends Selector
  ? {
      statusCode: Endpoints[T]['res']['statusCode'];
      headers: Record<string, string | string[] | undefined>;
      body?: string;
      bodyEncoding?: string;
      trailers: Record<string, string>;
      duration: number;
    }
  : {
      statusCode: Status;
      headers: Record<string, string | string[] | undefined>;
      body?: string;
      bodyEncoding?: string;
      trailers: Record<string, string>;
      duration: number;
    };

/** Options for a cross-endpoint request. */
export type RequestOptions = {
  /**
   * Run the target's own \`beforeEach\` → \`authorize\` → \`afterEach\` pipeline, so
   * a seeding call behaves like the real run. Default \`true\`; \`false\` is the
   * raw-seeding escape, and the way out of a cycle.
   */
  runHooks?: boolean;
  /** Force authorization on or off for this call. */
  authorize?: boolean;
};

/**
 * The typed setters, the file helpers and everything else a hook is handed.
 *
 * Setters write into the same request direct mutation does — a setter is a place
 * for the compiler to know a name and a value type, not a second mechanism.
 */
export interface HookUtils<T = unknown> {
  setHeader(name: string, value: string | string[] | undefined): void;
  setQuery(name: string, value: unknown): void;
  setPathParam(name: string, value: unknown): void;
  setCookie(name: string, value: unknown): void;
  setBody(body: unknown): void;
  setAuthorize(authorize: boolean): void;

  /** Reads a file **beside the hook that asks for it**. */
  readFile(path: string): Uint8Array;
  readText(path: string, encoding?: FileEncoding): string;
  readJson<R = unknown>(path: string): R;

  skip(message: string): never;
  fail(message: string): never;
  info(message: string): void;
  warn(message: string, details?: string): void;
  assertionSuccess(message: string, assertion?: string): void;
  assertionFailure(
    message: string,
    details?: { assertion?: string; expected?: unknown; actual?: unknown },
  ): void;
  timeout(message: string, durationMs: number): void;
  randomString(length?: number): string;

  /**
   * Call another Transaction, addressed by its Selector.
   *
   * There is no \`forStatusCode\`: the Selector already carries the status.
   */
  request<R extends Selector>(
    selector: R,
    args?: RequestArgsOf<R>,
    options?: RequestOptions,
  ): Promise<{
    statusCode: Endpoints[R]['res']['statusCode'];
    headers: Record<string, unknown>;
    body: Endpoints[R]['res']['body'];
  }>;
}

/**
 * The encodings \`readText\` understands.
 *
 * Spelled out rather than reusing \`BufferEncoding\`, and \`readFile\` answers
 * \`Uint8Array\` rather than \`Buffer\`, so this surface needs no \`@types/node\`.
 * A hook file that imports \`node:fs\` needs it and can add
 * \`"types": ["node"]\` — the scaffolded tsconfig is the author's from the
 * moment it is written.
 */
export type FileEncoding =
  | 'utf-8'
  | 'utf8'
  | 'ascii'
  | 'latin1'
  | 'base64'
  | 'base64url'
  | 'hex'
  | 'ucs-2'
  | 'utf-16le';

/** What a registration is, opaquely. Export one from a hook file to load it. */
export type HookRegistration = { readonly __hook: unique symbol };

/** What a \`beforeAll\` may return to be run on close. */
export type CleanupFn = () => void | Promise<void>;

/**
 * Shapes the generated request for a Transaction, at generation time.
 *
 * At most one per Transaction: a second is a conflict, reported at load.
 */
export declare function defineSample<const T extends HookTarget>(
  target: T,
  callback: (draft: RequestOf<T>, utils: HookUtils<T>) => void,
): HookRegistration;

/** Runs before each request of the targeted Transaction(s). */
export declare function beforeEach<const T extends HookTarget>(
  target: T,
  callback: (
    request: RequestOf<T>,
    ctx: unknown,
    utils: HookUtils<T>,
  ) => void | Promise<void>,
): HookRegistration;

/** Runs after each response of the targeted Transaction(s). */
export declare function afterEach<const T extends HookTarget>(
  target: T,
  callback: (
    response: ResponseOf<T>,
    ctx: unknown,
    utils: HookUtils<T>,
  ) => void | Promise<void>,
): HookRegistration;

/**
 * Supplies credentials. \`authorize(fn)\` is global; \`authorize(target, fn)\` is
 * targeted and wins for the Transactions it covers.
 *
 * Whether it runs is decided by the run option and the request's own
 * \`authorize\` flag, so a registered hook is necessary but not sufficient.
 */
export declare function authorize(
  callback: (
    request: GenericRequest,
    ctx: unknown,
    utils: HookUtils,
  ) => void | Promise<void>,
): HookRegistration;
export declare function authorize<const T extends HookTarget>(
  target: T,
  callback: (
    request: RequestOf<T>,
    ctx: unknown,
    utils: HookUtils<T>,
  ) => void | Promise<void>,
): HookRegistration;

/**
 * Runs once before the first request of the run, in registration order. A throw
 * aborts the run. May return a cleanup closure to be run on close.
 */
export declare function beforeAll(
  callback: (utils: HookUtils) => void | CleanupFn | Promise<void | CleanupFn>,
): HookRegistration;

/**
 * Runs on close, together with the cleanups \`beforeAll\` returned: one
 * reverse-ordered list, best-effort, and only if the run sent a request.
 */
export declare function afterAll(
  callback: (utils: HookUtils) => void | Promise<void>,
): HookRegistration;
`;
}
