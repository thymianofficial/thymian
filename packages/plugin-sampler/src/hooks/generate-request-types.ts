import {
  isEdgeType,
  type Parameter,
  type ThymianFormat,
  thymianHttpRequestToUrl,
} from '@thymian/core';
import CodeBlockWriter from 'code-block-writer';
import { compile, type JSONSchema } from 'json-schema-to-typescript';

function escapeJsonPointerSegment(segment: string | number): string {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

function normalizeCircularSchemaRefs<T>(schema: T): T {
  const activeStack = new Map<object, string>();

  const recurse = (current: unknown, path: string): unknown => {
    if (typeof current !== 'object' || current === null) {
      return current;
    }

    if (activeStack.has(current)) {
      return { $ref: activeStack.get(current) };
    }

    activeStack.set(current, path);

    let result: unknown;

    if (Array.isArray(current)) {
      result = current.map((item, index) => recurse(item, `${path}/${index}`));
    } else {
      result = Object.fromEntries(
        Object.entries(current).map(([key, value]) => [
          key,
          recurse(value, `${path}/${escapeJsonPointerSegment(key)}`),
        ]),
      );
    }

    activeStack.delete(current);

    return result;
  };

  return recurse(schema, '#') as T;
}

export async function generateTypeForSchema(
  schema: unknown,
  mediaType: string,
  typeName: string,
): Promise<GeneratedSchemaType> {
  if (!(mediaType === 'application/json' || mediaType.includes('+json'))) {
    return { declarations: [], type: 'unknown' };
  }

  const declaration = await compile(
    normalizeCircularSchemaRefs(schema) as JSONSchema,
    typeName,
    {
      bannerComment: '',
      additionalProperties: true,
      style: {
        semi: false,
      },
    },
  );

  return {
    declarations: [declaration],
    type: typeName,
  };
}

export async function generateTypeForParameters2(
  parameters: Record<string, Parameter>,
  nextTypeName: () => string,
): Promise<ParameterType> {
  const schema: {
    properties: Record<string, unknown>;
    required: string[];
    type: string;
  } = {
    type: 'object',
    properties: {},
    required: [],
  };

  for (const [name, param] of Object.entries(parameters)) {
    schema.properties[name] = param.schema;

    if (param.required) {
      schema.required.push(name);
    }
  }

  return {
    ...(await generateTypeForSchema(
      schema,
      "'application/json'",
      nextTypeName(),
    )),
    required: schema.required.length > 0,
  };
}

export async function generateTypeForParameters(
  parameters: Record<string, Parameter>,
  nextTypeName: () => string,
): Promise<ParameterType> {
  const result: {
    declarations: string[];
    required: boolean;
    types: Record<string, string>;
  } = {
    declarations: [],
    required: false,
    types: {},
  };

  for (const [name, param] of Object.entries(parameters)) {
    result.required ||= param.required;

    const generatedType = await generateTypeForSchema(
      param.schema,
      param.contentType ?? 'application/json',
      nextTypeName(),
    );

    result.types[name] = generatedType.type;
    result.declarations.push(...generatedType.declarations);
  }

  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
  });

  writer.block(() => {
    for (const [name, type] of Object.entries(result.types)) {
      writer.quote(name).write(': ').write(type).writeLine(';');
    }
  });

  return {
    declarations: result.declarations,
    type: writer.toString(),
    required: result.required,
  };
}

export type GeneratedSchemaType = {
  declarations: string[];
  type: string;
};

export type ParameterType = GeneratedSchemaType & {
  required: boolean;
};

export type ResponseType = {
  statusCode: number;
  body?: string;
  bodyDeclarations?: string[];
  headers: ParameterType;
};

export type GeneratedTypes = {
  types: Record<
    string,
    {
      req: {
        body?: string;
        bodyDeclarations?: string[];
        query: ParameterType;
        path: ParameterType;
        headers: ParameterType;
      };
      res: ResponseType[];
    }
  >;
  keyToTransactionId: Record<string, string>;
  declarations: string[];
};

export const staticCode = `
export type HttpRequestTemplate = {
  origin: string;
  path: string;
  pathParameters: Record<string, unknown>;
  method: string;
  query: Record<string, unknown>;
  authorize: boolean;
  bodyEncoding?: string;
  body?: unknown;
  headers: Record<string, unknown>;
  cookies: Record<string, unknown>;
};

export type ThymianHttpTransaction = {
  thymianReq: ThymianHttpRequest;
  thymianReqId: string;
  thymianRes: ThymianHttpResponse;
  thymianResId: string;
  transactionId: string;
  transaction: HttpTransaction;
};

export interface ThymianHttpRequest  {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  path: string;
  method: string;
  headers: Record<string, Parameter>;
  queryParameters: Record<string, Parameter>;
  cookies: Record<string, Parameter>;
  pathParameters: Record<string, Parameter>;
  description?: string;
  bodyRequired?: boolean;
  body?: ThymianSchema;
  mediaType: string;
  encoding?: Encoding;
}

export type Encoding = {
  [propertyName: string]: {
    contentType?: string;
    headers: Record<string, Parameter>;
    serializationStyle: SerializationStyle;
  };
};

export interface ThymianHttpResponse {
  description?: string;
  headers: Record<string, Parameter>;
  mediaType: string;
  statusCode: number;
  schema?: ThymianSchema;
}

export interface HttpTransaction {
}

export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body?: string;
  bodyEncoding?: string;
  trailers: Record<string, string>;
  duration: number;
};

export type HttpRequest = {
  origin: string;
  path: string;
  method: string;
  bodyEncoding?: string;
  body?: string;
  headers?: Record<string, string | string[] | undefined>;
};


export interface Parameter {
  description?: string;
  required: boolean;
  schema: ThymianSchema;
  contentType?: string;
  style: SerializationStyle;
}

export type Style =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject';

export interface SerializationStyle {
  explode: boolean;

  style: Style;
}

export type ThymianSchemaType =
  | 'null'
  | 'boolean'
  | 'object'
  | 'array'
  | 'number'
  | 'string'
  | 'integer';

export type ThymianSchema = {
  // Type
  type?: ThymianSchemaType | ThymianSchemaType[];
  const?: unknown;
  enum?: unknown[];

  examples?: unknown[];
  description?: string;
  default?: unknown;

  // Numbers
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;

  // Strings
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  format?: string;
  contentEncoding?: string;
  contentMediaType?: string;

  // Arrays
  prefixItems?: ThymianSchema[];
  items?: ThymianSchema;
  contains?: ThymianSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minContains?: number;
  maxContains?: number;

  // Objects
  properties?: Record<string, ThymianSchema>;
  patternProperties?: Record<string, ThymianSchema>;
  additionalProperties?: ThymianSchema | boolean;
  propertyNames?: ThymianSchema;
  required?: string[];
  minProperties?: number;
  maxProperties?: number;
  dependentSchemas?: Record<string, ThymianSchema>;
  dependentRequired?: Record<string, string[]>;

  allOf?: ThymianSchema[];
  anyOf?: ThymianSchema[];
  oneOf?: ThymianSchema[];
  not?: ThymianSchema;
  if?: ThymianSchema;
  then?: ThymianSchema;
  else?: ThymianSchema;

  unevaluatedProperties?: ThymianSchema | boolean;
  unevaluatedItems?: ThymianSchema | boolean;

  $ref?: string;
  $anchor?: string;

  xml?: {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: string;
    wrapped?: boolean;
  };
};


export type BeforeEachRequestHook = (request: HttpRequestTemplate, context: ThymianHttpTransaction | undefined, utils: HookUtils) => HttpRequestTemplate | Promise<HttpRequestTemplate>;

export type AfterEachRequestHookContext =  {
      requestTemplate: HttpRequestTemplate;
      request: HttpRequest;
      thymianTransaction?: ThymianHttpTransaction;
}

export type AfterEachRequestHook = (response: HttpResponse, context: AfterEachRequestHookContext, utils: HookUtils) => HttpResponse | Promise<HttpResponse>;

export type AuthorizeHook = (response: HttpRequestTemplate, context: ThymianHttpTransaction | undefined, utils: HookUtils) => HttpRequestTemplate | Promise<HttpRequestTemplate>;

export interface HookUtils {
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

  request<R extends keyof Endpoints>(
    req: R,
    args: Endpoints[R]['req'],
    options?: {
      runHooks?: boolean;
      authorize?: boolean;
      forStatusCode?: number;
    }
  ): Promise<Endpoints[R]['res']>;

  randomString(length?: number): string;
}
`;

export const infoText = `
/*
 * ========================================================================
 *
 * WARNING: THIS FILE IS AUTO-GENERATED. DO NOT EDIT.
 *
 * Any changes made to this file will be lost if the code is regenerated.
 *
 * ========================================================================
 */
`;

export function generatedTypesToString(generated: GeneratedTypes): string {
  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
  });

  writer.writeLine(infoText).write(staticCode);

  for (const declaration of generated.declarations) {
    writer.writeLine(declaration);
  }

  writer.writeLine(`export type Endpoints = `).block(() => {
    for (const [key, { req, res }] of Object.entries(generated.types)) {
      writer
        .quote(key)
        .write(':')
        .block(() => {
          writer
            .writeLine(`req:`)
            .block(() => {
              // body
              if (typeof req.body === 'string') {
                writer.writeLine(`body:`).writeLine(req.body!);
              }

              writer
                // query params
                .writeLine(`query${req.query.required ? '' : '?'}:`)
                .writeLine(req.query.type)
                .writeLine(' & { [query: string]: string | number | boolean }')

                // path params
                .writeLine(`path${req.path.required ? '' : '?'}:`)
                .writeLine(req.path.type)
                .writeLine(' & { [param: string]: string | number | boolean }')

                // headers
                .writeLine(`headers${req.headers.required ? '' : '?'}:`)
                .writeLine(req.headers.type)
                .writeLine(
                  ' & { [param: string]: string | string[] | undefined }',
                );
            })
            .write(',')
            .writeLine(`res:`);

          if (res.length === 0) {
            writer.write('never;');
          }

          for (const { statusCode, body, headers } of res) {
            writer.writeLine(`|`);
            writer.block(() => {
              writer
                .writeLine(`statusCode: ${statusCode};`)
                .writeLine(`headers${headers.required ? '' : '?'}:`)
                .writeLine(headers.type)
                .writeLine(
                  ' & { [param: string]: string | string[] | undefined }',
                );

              if (body) {
                writer.writeLine(`body:`).writeLine(body);
              }
            });
          }
        });
    }
  });

  return writer.toString();
}

const mediaTypeParameter: (mediaType: string) => Parameter = (mediaType) => ({
  schema: {
    type: 'string',
    const: mediaType,
  },
  required: true,
  style: { style: 'simple', explode: false },
});

export async function generateTypesForThymianFormat(
  format: ThymianFormat,
): Promise<GeneratedTypes> {
  const generated: GeneratedTypes = {
    declarations: [],
    types: {},
    keyToTransactionId: {},
  };
  let typeId = 0;
  const nextTypeName = () => `GeneratedSchema${++typeId}`;

  for (const [
    req,
    responses,
    reqId,
    responseIds,
  ] of format.getThymianHttpRequestsWithResponses()) {
    const allHeaders: Record<string, Parameter> = {
      ...req.headers,
    };

    if (req.mediaType) {
      allHeaders['content-type'] = mediaTypeParameter(req.mediaType);
    }

    const key = `${req.method.toUpperCase()} ${thymianHttpRequestToUrl(req)}`;
    const query = await generateTypeForParameters(
      req.queryParameters,
      nextTypeName,
    );
    const path = await generateTypeForParameters(
      req.pathParameters,
      nextTypeName,
    );
    const headers = await generateTypeForParameters(allHeaders, nextTypeName);
    const body = req.body
      ? await generateTypeForSchema(req.body, req.mediaType, nextTypeName())
      : undefined;
    generated.declarations.push(
      ...query.declarations,
      ...path.declarations,
      ...headers.declarations,
      ...(body?.declarations ?? []),
    );
    const res: ResponseType[] = await Promise.all(
      responses.map(async (res) => {
        const headers = {
          ...res.headers,
        };

        if (res.mediaType) {
          headers['content-type'] = mediaTypeParameter(res.mediaType);
        }

        const result: ResponseType = {
          statusCode: res.statusCode,
          headers: await generateTypeForParameters(headers, nextTypeName),
        };

        generated.declarations.push(...result.headers.declarations);

        if (res.schema) {
          const body = await generateTypeForSchema(
            res.schema,
            res.mediaType,
            nextTypeName(),
          );
          result.body = body.type;
          result.bodyDeclarations = body.declarations;
          generated.declarations.push(...body.declarations);
        }

        return result;
      }),
    );

    const default2xxResponse = res
      .filter((r) => r.statusCode >= 200 && r.statusCode < 300)
      .sort((a, b) => a.statusCode - b.statusCode)[0];

    if (default2xxResponse) {
      const idx = res.indexOf(default2xxResponse);

      // this should never happen, but just in case
      if (idx < 0) {
        throw new Error('Could not find default 2xx response');
      }

      const transactionId = format.graph.findEdge(
        reqId,
        responseIds[idx]!,
        (edgeId, edge) => isEdgeType(edge, 'http-transaction'),
      );

      if (!transactionId) {
        throw new Error(
          'Could not find transaction ID for default 2xx response',
        );
      }

      generated.keyToTransactionId[key] = transactionId;
    }

    for (const [idx, response] of res.entries()) {
      const transactionId = format.graph.findEdge(
        reqId,
        responseIds[idx]!,
        (edgeId, edge) => isEdgeType(edge, 'http-transaction'),
      );

      // should never happen, but just in case
      if (!transactionId) {
        throw new Error(
          'Could not find transaction ID for default 2xx response',
        );
      }

      generated.keyToTransactionId[`${key}->${response.statusCode}`] =
        transactionId;
    }

    generated.types[key] = {
      req: {
        query,
        headers,
        path,
        body: body?.type,
        bodyDeclarations: body?.declarations,
      },
      res,
    };
  }

  return generated;
}
