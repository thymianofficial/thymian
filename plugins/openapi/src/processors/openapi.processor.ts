import {
  isNodeType,
  type Logger,
  ThymianFormat,
  type ThymianHttpRequest,
} from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import { processLinkObjectParameters } from './link-object.processor.js';
import { processParameterObjects } from './parameter-object.processor.js';
import { processRequestBodyObjet } from './request-body-object.processor.js';
import { processResponsesObject } from './responses-object.processor.js';
import { processSecuritySchemes } from './security-scheme-object.processor.js';
import { mergeParameters, type Parameters } from './utils.js';

export type OpenapiV30ParserOptions = {
  port: number;
  host: string;
  protocol: 'http' | 'https';
};

export type LinkObjectToProcess = {
  linkObj: OpenApiV31.LinkObject;
  name: string;
  responseIds: string[];
};

/*
https://swagger.io/specification/v3/
 */
export class OpenapiProcessor {
  private readonly linkObjects: LinkObjectToProcess[] = [];

  private readonly securitySchemeToNodeId: Record<string, string> = {};

  private globalSecuritySchemes: string[] = [];

  private readonly format = new ThymianFormat();

  constructor(
    private readonly logger: Logger,
    private readonly options: OpenapiV30ParserOptions
  ) {}

  private processLinkObject(linkObjectToProcess: LinkObjectToProcess): void {
    if (!linkObjectToProcess.linkObj.operationId) {
      return;
    }

    const reqs = this.format.graph.filterNodes(
      (id, attributes) =>
        isNodeType(attributes, 'http-request') &&
        attributes.extensions?.openapiV3?.operationId ===
          linkObjectToProcess.linkObj.operationId
    );

    linkObjectToProcess.responseIds.forEach((resId) => {
      reqs.forEach((reqId) => {
        this.format.addHttpLink(resId, reqId, {
          ...processLinkObjectParameters(
            linkObjectToProcess.linkObj.parameters,
            this.format.getNode(reqId) as ThymianHttpRequest
          ),
        });
      });
    });
  }

  private processOperationObject(
    operationObject: OpenApiV31.OperationObject,
    params: Parameters,
    method: string,
    path: string
  ): void {
    if (operationObject.deprecated) {
      this.logger.debug(
        `Operation with id "${
          operationObject.operationId ?? '(no operationId provided)'
        }" is deprecated but still used by Thymian.`
      );
    }

    const parameters = mergeParameters(
      params,
      processParameterObjects(
        operationObject.parameters as OpenApiV31.ParameterObject[]
      )
    );

    const requests = processRequestBodyObjet(
      operationObject.requestBody as OpenApiV31.RequestBodyObject,
      parameters,
      {
        host: this.options.host,
        port: this.options.port,
        protocol: this.options.protocol,
        operationId: operationObject.operationId,
        method,
        path,
      }
    );
    const requestIds = requests.map((req) => this.format.addRequest(req));

    const securitySchemes = this.globalSecuritySchemes.length
      ? this.globalSecuritySchemes
      : operationObject.security?.length
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        operationObject.security.map((sec) => Object.keys(sec)[0]!)
      : [];

    requestIds.forEach((reqId) => {
      securitySchemes.forEach((scheme) => {
        if (typeof this.securitySchemeToNodeId[scheme] === 'string') {
          this.format.addEdge(reqId, this.securitySchemeToNodeId[scheme], {
            type: 'is-secured',
          });
        }
      });
    });

    const responsesAndLinks = processResponsesObject(
      operationObject.responses,
      parameters
    );

    const allResponseIds: string[] = [];

    for (const { responses, links } of responsesAndLinks) {
      const responseIds = responses.map((res) => this.format.addResponse(res));

      links.forEach(({ name, linkObj }) => {
        this.linkObjects.push({
          name,
          linkObj,
          responseIds,
        });
      });

      allResponseIds.push(...responseIds);
    }

    requestIds.forEach((source) => {
      allResponseIds.forEach((target) => {
        this.format.addHttpTransaction(source, target);
      });
    });
  }

  public process(document: OpenApiV31.Document): ThymianFormat {
    this.logger.debug(
      `Processing OpenAPI document in version ${document.openapi}.`
    );

    const securitySchemes = processSecuritySchemes(
      (document.components?.securitySchemes as Record<
        string,
        OpenApiV31.SecuritySchemeObject
      >) ?? {}
    );

    securitySchemes.forEach((scheme) => {
      this.securitySchemeToNodeId[scheme.extensions.openapiV3.schemeName] =
        this.format.addNode(scheme);
    });

    document.security?.forEach((security) => {
      const name = Object.keys(security)[0];

      if (name) {
        this.globalSecuritySchemes.push(name);
      }
    });

    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      if (typeof pathItem === 'undefined') {
        continue;
      }

      const parameters = processParameterObjects(
        pathItem.parameters as OpenApiV31.ParameterObject[]
      );

      for (const [method, op] of Object.entries(pathItem)) {
        const operation = op as OpenApiV31.OperationObject;

        const operationParameters = processParameterObjects(
          operation.parameters as OpenApiV31.ParameterObject[]
        );

        this.processOperationObject(
          operation,
          mergeParameters(parameters, operationParameters),
          method,
          path
        );
      }
    }

    this.linkObjects.forEach((linkToProcess) =>
      this.processLinkObject(linkToProcess)
    );

    return this.format;
  }
}
