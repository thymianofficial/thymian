import type { Parameter } from '../../format/parameter.js';
import type { ThymianSchema } from '../../format/thymian-schema.js';
import type { ThymianHttpRequest } from '../../index.js';
import {
  deserializeObjectParameter,
  deserializeQueryParameter,
  flattenSchema,
  splitWireList,
  structuralKind,
  unreconstructableValueMessage,
} from '../deserialize-parameter.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { resultsForDeserialized } from './validate-deserialized.js';

/**
 * A query parameter as it arrived on the wire. A single occurrence is a
 * `string` and a repeated or delimited one a `string[]`; a `Record` is an
 * object parameter already reassembled from its constituent keys.
 */
export type QueryParameterWireValue =
  string | string[] | Record<string, string | string[]>;

/** `name[property]`, with any trailing nesting captured so it can be rejected. */
const BRACKET_KEY = /^([^[]+)((?:\[[^\]]*\])+)$/;
const SINGLE_PROPERTY = /^\[([^\]]*)\]$/;

function isObjectValue(
  value: QueryParameterWireValue,
): value is Record<string, string | string[]> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** `application/x-www-form-urlencoded`: `+` is a space, then percent-decoding. */
function decodeFormComponent(raw: string): string {
  const spaced = raw.replace(/\+/g, ' ');

  try {
    return decodeURIComponent(spaced);
  } catch {
    // A malformed escape is not this module's problem to report; keep the
    // `+` decoding rather than throwing out of a validator.
    return spaced;
  }
}

/** Declared-parameter lookup that never reaches through `Object.prototype`. */
function declaredParameter(
  request: ThymianHttpRequest,
  name: string,
): Parameter | undefined {
  return Object.hasOwn(request.queryParameters, name)
    ? request.queryParameters[name]
    : undefined;
}

/**
 * The declared property names of an object schema, seen through `$ref`/`allOf`.
 *
 * Reading `schema.properties` raw is the same defect as reading `schema.type`
 * raw: a `$ref`ed object shows no properties, is mistaken for free-form, and
 * silently absorbs every unclaimed query key — typos included.
 */
function declaredPropertyNames(schema: ThymianSchema | undefined): string[] {
  return Object.keys(flattenSchema(schema, schema ?? {})?.properties ?? {});
}

/** Whether a parameter is an object whose properties arrive as bare keys. */
function isExplodedObjectParameter(parameter: Parameter): boolean {
  return (
    parameter.style?.style === 'form' &&
    parameter.style.explode === true &&
    // `structuralKind`, not a raw `type` read: a schema that
    // also allows `string` accepts the value whole and must not be folded.
    structuralKind(parameter.schema) === 'object'
  );
}

/**
 * Split the query string into still-encoded `[key, value]` pairs.
 *
 * Hand-rolled rather than `URLSearchParams` because delimiter splitting for
 * non-exploded arrays has to happen *before* percent-decoding — `?ids=a%2Cb` is
 * one item, not two — and `URLSearchParams` only ever hands back decoded
 * values. Splits on the first `=` only, so a value containing `=` survives.
 */
function rawPairs(queryString: string): [string, string][] {
  const pairs: [string, string][] = [];

  for (const part of queryString.split('&')) {
    if (part === '') {
      continue;
    }

    const separator = part.indexOf('=');
    const rawKey = separator === -1 ? part : part.slice(0, separator);
    const rawValue = separator === -1 ? '' : part.slice(separator + 1);

    // An empty key carries no parameter; the previous parser skipped these too.
    if (rawKey === '') {
      continue;
    }

    pairs.push([rawKey, rawValue]);
  }

  return pairs;
}

/**
 * Parse a query string into its parameters, reassembling object parameters the
 * description declares.
 *
 * Object reassembly has to happen here rather than in
 * `validateExistingQueryParameter`, because the additional- and
 * missing-parameter checks key off this map: without it, `?filter[id]=1`
 * reports `filter[id]` as undocumented *and* the documented `filter` as absent.
 * The same is true of a `form`/`explode: true` object, whose properties arrive
 * as bare top-level keys.
 */
interface ParsedQuery {
  parameters: Record<string, QueryParameterWireValue>;
  /** Parameters whose wire form could not be parsed at all — reported as an
   *  `info`, never validated, and never counted as missing. */
  unparseable: Set<string>;
}

function parseQuery(
  queryString: string,
  request: ThymianHttpRequest,
): ParsedQuery {
  // Exported callers may hand over a search string including its `?`.
  const search = queryString.startsWith('?')
    ? queryString.slice(1)
    : queryString;
  const objects = new Map<string, Map<string, string[]>>();
  const unparseable = new Set<string>();
  const scalars = new Map<string, string[]>();

  const addProperty = (name: string, property: string, value: string) => {
    const target = objects.get(name) ?? new Map<string, string[]>();
    target.set(property, [...(target.get(property) ?? []), value]);
    objects.set(name, target);
  };

  for (const [rawKey, rawValue] of rawPairs(search)) {
    // Bracket structure is matched on the RAW key, before decoding: an encoded
    // `%5D` inside a property name must not be mistaken for a closing bracket,
    // and an encoded `[` must not become one.
    const [, rawName, rawBrackets] = BRACKET_KEY.exec(rawKey) ?? [];
    const bracketName =
      rawName === undefined ? undefined : decodeFormComponent(rawName);

    if (
      bracketName !== undefined &&
      rawBrackets !== undefined &&
      declaredParameter(request, bracketName)?.style?.style === 'deepObject'
    ) {
      const [, rawProperty] = SINGLE_PROPERTY.exec(rawBrackets) ?? [];

      // Nested (`filter[a][b]`) or empty (`filter[]`) property paths are not
      // OpenAPI `deepObject`. Absorb the key so it is not misreported as an
      // undocumented parameter, and mark the parameter unparseable so the
      // schema is never asked about a value we could not reconstruct.
      if (rawProperty === undefined || rawProperty === '') {
        unparseable.add(bracketName);
        continue;
      }

      addProperty(
        bracketName,
        decodeFormComponent(rawProperty),
        decodeFormComponent(rawValue),
      );
      continue;
    }

    const key = decodeFormComponent(rawKey);
    const declared = declaredParameter(request, key);
    const kind =
      declared === undefined ? undefined : structuralKind(declared.schema);
    // `form`/`explode: false` serializes BOTH arrays (`a,b`) and objects
    // (`k,v,k,v`) as one comma-delimited value.
    const isNonExplodedList =
      declared?.style?.style === 'form' &&
      !declared.style.explode &&
      kind !== undefined;

    // Split the still-encoded value, then decode each item.
    const values = isNonExplodedList
      ? splitWireList(rawValue, decodeFormComponent)
      : [decodeFormComponent(rawValue)];

    // A repeated non-exploded list (`?ids=1,2&ids=3`) is concatenated rather
    // than reported. Deliberate: the members are unambiguous either way, and
    // the schema still sees every value the client sent. Scalar pollution IS
    // still reported (see `deserializeItems`), because there the extra value
    // changes the type rather than extending a list.
    scalars.set(key, [...(scalars.get(key) ?? []), ...values]);
  }

  // A `form`/`explode: true` object parameter sends each property as its own
  // top-level key, so fold any key that matches it and is not itself a
  // declared parameter.
  const objectParameters = Object.entries(request.queryParameters).filter(
    ([, parameter]) => isExplodedObjectParameter(parameter),
  );

  // Count every key each object parameter could claim — including the keys a
  // FREE-FORM object would swallow. Counting only declared properties let a
  // free-form object claim everything unopposed, making folding depend on
  // declaration order.
  const claims = new Map<string, number>();

  for (const [, parameter] of objectParameters) {
    const declaredProperties = declaredPropertyNames(parameter.schema);
    const candidates =
      declaredProperties.length > 0 ? declaredProperties : [...scalars.keys()];

    for (const property of candidates) {
      claims.set(property, (claims.get(property) ?? 0) + 1);
    }
  }

  const ambiguous = new Set(
    [...claims].filter(([, count]) => count > 1).map(([property]) => property),
  );

  for (const [name, parameter] of objectParameters) {
    const declaredProperties = declaredPropertyNames(parameter.schema);
    // A free-form object (`additionalProperties`/`patternProperties`) declares
    // no property names, so every unclaimed key is a candidate.
    const candidates =
      declaredProperties.length > 0 ? declaredProperties : [...scalars.keys()];

    for (const property of candidates) {
      if (
        !scalars.has(property) ||
        // A key that is itself a declared parameter belongs to that parameter.
        Object.hasOwn(request.queryParameters, property) ||
        // Two object parameters claiming one key is genuinely ambiguous;
        // folding into whichever came first in declaration order would be
        // arbitrary, so fold into neither and let both be reported.
        ambiguous.has(property)
      ) {
        continue;
      }

      for (const value of scalars.get(property) ?? []) {
        addProperty(name, property, value);
      }

      scalars.delete(property);
    }
  }

  // `Object.create(null)`: a bare `?__proto__=x` key assigned onto an object
  // literal would hit the `__proto__` setter, replacing the prototype and
  // vanishing from the undocumented-parameter check entirely.
  const parameters = Object.create(null) as Record<
    string,
    QueryParameterWireValue
  >;

  for (const [key, values] of scalars) {
    parameters[key] = values.length === 1 ? (values[0] as string) : values;
  }

  for (const [name, properties] of objects) {
    // A parameter that also arrived as a bare key is malformed. Leave the bare
    // value in place so the schema reports it, rather than silently discarding
    // one of the two.
    if (Object.hasOwn(parameters, name)) {
      continue;
    }

    parameters[name] = Object.fromEntries(
      [...properties].map(([property, values]) => [
        property,
        values.length === 1 ? (values[0] as string) : values,
      ]),
    );
  }

  // An unparseable parameter with no salvageable siblings must not surface as
  // an empty object — that fabricates `must have required property …` for a
  // value that was never parsed.
  for (const name of unparseable) {
    if (!Object.hasOwn(parameters, name)) {
      continue;
    }

    const value = parameters[name];

    if (
      value !== undefined &&
      isObjectValue(value) &&
      Object.keys(value).length === 0
    ) {
      delete parameters[name];
    }
  }

  return { parameters: { ...parameters }, unparseable };
}

/**
 * Parse a query string into its parameters, reassembling object parameters the
 * description declares.
 *
 * Object reassembly has to happen here rather than in
 * `validateExistingQueryParameter`, because the additional- and
 * missing-parameter checks key off this map: without it, `?filter[id]=1`
 * reports `filter[id]` as undocumented *and* the documented `filter` as absent.
 * The same is true of a `form`/`explode: true` object, whose properties arrive
 * as bare top-level keys.
 */
export function parseQueryParameters(
  queryString: string,
  request: ThymianHttpRequest,
): Record<string, QueryParameterWireValue> {
  return parseQuery(queryString, request).parameters;
}

export function checkForMissingQueryParameters(
  queryParams: Record<string, QueryParameterWireValue>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  return Object.entries(request.queryParameters).reduce(
    (acc, [name, param]) => {
      if (!Object.hasOwn(queryParams, name) && param.required) {
        acc.push({
          type: 'assertion-failure',
          message: `Query parameter "${name}" is required but not included in the request.`,
        });
      }

      return acc;
    },
    [] as HttpTestCaseResult[],
  );
}

export function checkForAdditionalQueryParameters(
  queryParams: Record<string, QueryParameterWireValue>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  const failures = Object.keys(queryParams)
    .filter((name) => !Object.hasOwn(request.queryParameters, name))
    .map((name) => ({
      type: 'assertion-failure',
      message: `Request contains query parameter "${name}" that is not included in the description format.`,
    })) as HttpTestCaseResult[];

  return failures.length > 0
    ? failures
    : [
        {
          type: 'assertion-success',
          message: `Request does not contain additional query parameters that are not included in the description format.`,
        },
      ];
}

export function validateExistingQueryParameter(
  queryParams: Record<string, QueryParameterWireValue>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  return Object.entries(queryParams)
    .filter(([name]) => Object.hasOwn(request.queryParameters, name))
    .flatMap(([name, value]): HttpTestCaseResult[] => {
      const parameter = declaredParameter(request, name);

      if (parameter?.schema) {
        // Query parameters are strings on the wire; `style`/`explode` describe
        // how the described type was serialized into them. Rebuild that value
        // before validating, or every non-string parameter fails on type.
        let deserialized;

        if (isObjectValue(value)) {
          deserialized = deserializeObjectParameter(
            Object.entries(value),
            parameter.schema,
            parameter.style,
          );
        } else if (parameter.style?.style === 'deepObject') {
          // Declared `deepObject` but sent as a bare value: a request defect,
          // so let the schema report it rather than claiming thymian could not
          // deserialize the style.
          deserialized = { supported: true as const, value };
        } else {
          deserialized = deserializeQueryParameter(
            Array.isArray(value) ? value : [value],
            parameter.schema,
            parameter.style,
          );
        }

        return resultsForDeserialized(
          deserialized,
          parameter.schema,
          `Query parameter "${name}"`,
          `query parameter "${name}"`,
          `Valid query parameter "${name}".`,
        );
      }

      return [
        {
          type: 'info',
          message: `No schema provided for query parameter "${name}".`,
          timestamp: Date.now(),
        },
      ];
    });
}

export function validateRequestQueryParameters(
  path: string,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  // The fragment is not part of the URL's query, and it may itself contain a
  // `?` — so it has to come off BEFORE looking for the query delimiter.
  const withoutFragment = path.split('#')[0] ?? path;
  const separator = withoutFragment.indexOf('?');
  // Everything after the FIRST `?` is the query string; a later `?` is an
  // ordinary character within it, not a second delimiter.
  const queryString =
    separator === -1 ? '' : withoutFragment.slice(separator + 1);
  const { parameters, unparseable } = parseQuery(queryString, request);

  // A parameter whose wire form could not be reconstructed is reported once,
  // honestly, and then left alone: asking the schema about a value we failed
  // to parse fabricates violations the request never committed.
  const unparseableResults = [...unparseable]
    .filter((name) => Object.hasOwn(request.queryParameters, name))
    .map((name): HttpTestCaseResult => ({
      type: 'info',
      // `deepObject` is the only style whose parsing can fail this way — see
      // the bracket branch in `parseQuery`, the sole writer to `unparseable`.
      // NOT `unsupportedStyleMessage`: thymian reverses `deepObject` fine,
      // and it is this key shape OpenAPI leaves undefined.
      message: unreconstructableValueMessage(
        `Query parameter "${name}"`,
        'deepObject',
      ),
      timestamp: Date.now(),
    }));

  const skipped = (name: string) => unparseable.has(name);
  const visible = Object.fromEntries(
    Object.entries(parameters).filter(([name]) => !skipped(name)),
  );

  return [
    ...checkForMissingQueryParameters(visible, {
      ...request,
      queryParameters: Object.fromEntries(
        Object.entries(request.queryParameters).filter(
          ([name]) => !skipped(name),
        ),
      ),
    }),
    ...checkForAdditionalQueryParameters(visible, request),
    ...validateExistingQueryParameter(visible, request),
    ...unparseableResults,
  ];
}
