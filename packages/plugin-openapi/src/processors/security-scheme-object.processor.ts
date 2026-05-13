import type {
  ApiKeySecurityScheme,
  BasicSecurityScheme,
  BearerSecurityScheme,
  PartialBy,
  SecurityScheme,
} from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import { resolveOpenApiReference } from './openapi-reference-resolver.js';

export function processSecuritySchemes(
  schemes: Record<
    string,
    OpenApiV31.SecuritySchemeObject | OpenApiV31.ReferenceObject
  >,
  document: OpenApiV31.Document,
): PartialBy<SecurityScheme, 'label' | 'sourceName'>[] {
  return Object.entries(schemes)
    .map(
      ([name, scheme]) =>
        [
          name,
          resolveOpenApiReference<OpenApiV31.SecuritySchemeObject>(
            scheme,
            document,
            'security scheme',
          ),
        ] as const,
    )
    .filter(([, scheme]) => scheme.type === 'http' || scheme.type === 'apiKey')
    .map(([name, schemeObj]) => {
      if (schemeObj.type === 'apiKey') {
        return {
          type: 'security-scheme',
          scheme: 'api-key',
          in: schemeObj.in,
          extensions: {
            openapi: {
              schemeName: name,
            },
          },
        } satisfies PartialBy<ApiKeySecurityScheme, 'label' | 'sourceName'>;
      } else if ('scheme' in schemeObj) {
        if (schemeObj.scheme === 'basic') {
          return {
            type: 'security-scheme',
            scheme: 'basic',
            extensions: {
              openapi: {
                schemeName: name,
              },
            },
          } satisfies PartialBy<BasicSecurityScheme, 'label' | 'sourceName'>;
        } else if (schemeObj.scheme === 'bearer') {
          return {
            type: 'security-scheme',
            scheme: 'bearer',
            bearerFormat: schemeObj.bearerFormat,
            extensions: {
              openapi: {
                schemeName: name,
              },
            },
          } satisfies PartialBy<BearerSecurityScheme, 'label' | 'sourceName'>;
        } else {
          throw new Error(`Scheme ${schemeObj.scheme} not supported.`);
        }
      } else {
        throw new Error(
          'Property "scheme" is required for security scheme type "http".',
        );
      }
    });
}
