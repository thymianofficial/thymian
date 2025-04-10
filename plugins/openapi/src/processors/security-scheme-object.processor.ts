import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';
import type {
  ApiKeySecurityScheme,
  BasicSecurityScheme,
  BearerSecurityScheme,
  SecurityScheme,
} from '@thymian/core';

export function processSecuritySchemes(
  schemes: Record<string, OpenApiV31.SecuritySchemeObject>
): SecurityScheme[] {
  return Object.entries(schemes)
    .filter(([, scheme]) => scheme.type === 'http' || scheme.type === 'apiKey')
    .map(([name, schemeObj]) => {
      if (schemeObj.type === 'apiKey') {
        return {
          type: 'security-scheme',
          scheme: 'api-key',
          in: schemeObj.in,
          extensions: {
            openapiV3: {
              schemeName: name,
            },
          },
        } satisfies ApiKeySecurityScheme;
      } else if ('scheme' in schemeObj) {
        if (schemeObj.scheme === 'basic') {
          return {
            type: 'security-scheme',
            scheme: 'basic',
            extensions: {
              openapiV3: {
                schemeName: name,
              },
            },
          } satisfies BasicSecurityScheme;
        } else if (schemeObj.scheme === 'bearer') {
          return {
            type: 'security-scheme',
            scheme: 'bearer',
            bearerFormat: schemeObj.bearerFormat,
            extensions: {
              openapiV3: {
                schemeName: name,
              },
            },
          } satisfies BearerSecurityScheme;
        } else {
          throw new Error(`Scheme ${schemeObj.scheme} not supported.`);
        }
      } else {
        throw new Error(
          'Property "scheme" is required for security scheme type "http".'
        );
      }
    });
}
