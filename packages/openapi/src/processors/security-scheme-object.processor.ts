import type {
  ApiKeySecurityScheme,
  BasicSecurityScheme,
  BearerSecurityScheme,
  PartialBy,
  SecurityScheme,
} from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

export function processSecuritySchemes(
  schemes: Record<string, OpenApiV31.SecuritySchemeObject>,
): PartialBy<SecurityScheme, 'label'>[] {
  return Object.entries(schemes)
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
        } satisfies PartialBy<ApiKeySecurityScheme, 'label'>;
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
          } satisfies PartialBy<BasicSecurityScheme, 'label'>;
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
          } satisfies PartialBy<BearerSecurityScheme, 'label'>;
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
