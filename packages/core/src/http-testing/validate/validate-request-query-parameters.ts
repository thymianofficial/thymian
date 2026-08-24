import type { Parameter } from '../../format/parameter.js';
import type { ThymianSchema } from '../../format/thymian-schema.js';
import type { ThymianHttpRequest } from '../../index.js';
import {
  deserializeObjectParameter,
  deserializeQueryParameter,
  malformedStyleMessage,
  schemaTypes,
  splitWireList,
  unsupportedStyleMessage,
} from '../deserialize-parameter.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';
import { describeSchemaError, schemaErrorDetail } from './schema-error.js';

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
 * Every structural decision below — split this value? fold this object? —
 * must resolve `$ref`/`allOf` exactly as the typing step does. A second,
 * non-resolving copy of this logic is how `$ref`ed parameters slipped through
 * a whole review round.
 */
function typesOf(schema: ThymianSchema | undefined): string[] {
  return schemaTypes(schema);
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
export function parseQueryParameters(
  queryString: string,
  request: ThymianHttpRequest,
): Record<string, QueryParameterWireValue> {
  // Exported, so a caller may hand over a search string including its `?`.
  const search = queryString.startsWith('?')
    ? queryString.slice(1)
    : queryString;
  const objects = new Map<string, Map<string, string[]>>();
  const nested = new Set<string>();
  const scalars = new Map<string, string[]>();

  const addProperty = (name: string, property: string, value: string) => {
    const target = objects.get(name) ?? new Map<string, string[]>();
    target.set(property, [...(target.get(property) ?? []), value]);
    objects.set(name, target);
  };

  for (const [rawKey, rawValue] of rawPairs(search)) {
    const key = decodeFormComponent(rawKey);
    const [, bracketName, brackets] = BRACKET_KEY.exec(key) ?? [];

    if (
      bracketName !== undefined &&
      brackets !== undefined &&
      declaredParameter(request, bracketName)?.style?.style === 'deepObject'
    ) {
      const [, property] = SINGLE_PROPERTY.exec(brackets) ?? [];

      // Nested (`filter[a][b]`) or empty (`filter[]`) property paths are not
      // OpenAPI `deepObject`. Absorb them so they are not misreported as
      // undocumented parameters, and mark the parameter unvalidatable.
      if (property === undefined || property === '') {
        nested.add(bracketName);
        objects.set(bracketName, objects.get(bracketName) ?? new Map());
        continue;
      }

      addProperty(bracketName, property, decodeFormComponent(rawValue));
      continue;
    }

    const declared = declaredParameter(request, key);
    const declaredTypes =
      declared === undefined ? [] : typesOf(declared.schema);
    // `form`/`explode: false` serializes BOTH arrays (`a,b`) and objects
    // (`k,v,k,v`) as one comma-delimited value.
    const isNonExplodedList =
      declared !== undefined &&
      declared.style?.style === 'form' &&
      !declared.style.explode &&
      !declaredTypes.includes('string') &&
      (declaredTypes.includes('array') || declaredTypes.includes('object'));

    // Split the still-encoded value, then decode each item.
    const values = isNonExplodedList
      ? splitWireList(rawValue, decodeFormComponent)
      : [decodeFormComponent(rawValue)];

    scalars.set(key, [...(scalars.get(key) ?? []), ...values]);
  }

  // A `form`/`explode: true` object parameter sends each property as its own
  // top-level key, so fold any key that matches a declared property and is not
  // itself a declared parameter.
  const objectParameters = Object.entries(request.queryParameters).filter(
    ([, parameter]) =>
      parameter.style?.style === 'form' &&
      parameter.style.explode &&
      typesOf(parameter.schema).includes('object'),
  );
  const claims = new Map<string, number>();

  for (const [, parameter] of objectParameters) {
    for (const property of Object.keys(parameter.schema?.properties ?? {})) {
      claims.set(property, (claims.get(property) ?? 0) + 1);
    }
  }

  const ambiguous = new Set(
    [...claims].filter(([, count]) => count > 1).map(([property]) => property),
  );

  for (const [name, parameter] of Object.entries(request.queryParameters)) {
    if (
      parameter.style?.style !== 'form' ||
      !parameter.style.explode ||
      !typesOf(parameter.schema).includes('object')
    ) {
      continue;
    }

    const declaredProperties = Object.keys(parameter.schema?.properties ?? {});
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

    // A stray nested key (`filter[a][b]`) is absorbed so it never reads as
    // "undocumented", but the siblings that DID parse are kept — discarding
    // them fabricated a "property is required" for a property that was sent.
    parameters[name] = Object.fromEntries(
      [...properties].map(([property, values]) => [
        property,
        values.length === 1 ? (values[0] as string) : values,
      ]),
    );
  }

  return { ...parameters };
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

        if (!deserialized.supported) {
          // A style thymian cannot reverse is thymian's limitation (`info`);
          // a value not in its declared style is the request's defect.
          return [
            deserialized.malformed
              ? {
                  type: 'assertion-failure',
                  message: malformedStyleMessage(
                    `Query parameter "${name}"`,
                    deserialized,
                  ),
                  timestamp: Date.now(),
                }
              : {
                  type: 'info',
                  message: unsupportedStyleMessage(
                    `Query parameter "${name}"`,
                    deserialized,
                  ),
                  timestamp: Date.now(),
                },
          ];
        }

        const validate = ajv.compile(parameter.schema);

        validate(deserialized.value);

        if (validate.errors && validate.errors.length > 0) {
          // One assertion-failure per schema error rather than a joined message.
          return validate.errors.map((err) => ({
            type: 'assertion-failure',
            message: describeSchemaError(err, `query parameter "${name}"`),
            ...schemaErrorDetail(err),
            timestamp: Date.now(),
          }));
        }

        return [
          {
            type: 'assertion-success',
            message: `Valid query parameter "${name}".`,
            timestamp: Date.now(),
          },
        ];
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
  const separator = path.indexOf('?');
  // Everything after the FIRST `?` is the query string — a later `?` is an
  // ordinary character within it, not a second delimiter — and a `#` fragment
  // is not part of the query at all.
  const queryString =
    separator === -1 ? '' : (path.slice(separator + 1).split('#')[0] ?? '');
  const queryParams = parseQueryParameters(queryString, request);

  return [
    ...checkForMissingQueryParameters(queryParams, request),
    ...checkForAdditionalQueryParameters(queryParams, request),
    ...validateExistingQueryParameter(queryParams, request),
  ];
}
