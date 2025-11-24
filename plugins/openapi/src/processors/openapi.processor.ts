import { join } from 'node:path';

import {
  isNodeType,
  type Logger,
  ThymianFormat,
  type ThymianHttpRequest,
} from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import type { LocMapper } from '../loc-mapper/loc-mapper.js';
import { extractServerInfo, type ServerInfo } from './extract-server-info.js';
import { processLinkObjectParameters } from './link-object.processor.js';
import { processParameterObjects } from './parameter-object.processor.js';
import { processRequestBodyObjet } from './request-body-object.processor.js';
import { processResponsesObject } from './responses-object.processor.js';
import { processSecuritySchemes } from './security-scheme-object.processor.js';
import { mergeParameters, type Parameters } from './utils.js';

export type OpenapiV30ParserOptions = ServerInfo;

export type LinkObjectToProcess = {
  linkObj: OpenApiV31.LinkObject;
  name: string;
  responseIds: string[];
};

export const supportedMethods = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
];

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
    private readonly options: OpenapiV30ParserOptions,
    private readonly locMapper: LocMapper,
  ) {}

  private processLinkObject(linkObjectToProcess: LinkObjectToProcess): void {
    if (!linkObjectToProcess.linkObj.operationId) {
      return;
    }

    const reqs = this.format.graph.filterNodes(
      (id, attributes) =>
        isNodeType(attributes, 'http-request') &&
        attributes.extensions?.openapi?.operationId ===
          linkObjectToProcess.linkObj.operationId,
    );

    linkObjectToProcess.responseIds.forEach((resId) => {
      reqs.forEach((reqId) => {
        this.format.addHttpLink(resId, reqId, {
          ...processLinkObjectParameters(
            linkObjectToProcess.linkObj.parameters,
            this.format.getNode(reqId) as ThymianHttpRequest,
          ),
        });
      });
    });
  }

  private processOperationObject(
    operationObject: OpenApiV31.OperationObject,
    params: Parameters,
    method: string,
    path: string,
    serverInfo: ServerInfo,
  ): void {
    if (operationObject.deprecated) {
      this.logger.debug(
        `Operation with id "${
          operationObject.operationId ?? '(no operationId provided)'
        }" is deprecated but still used by Thymian.`,
      );
    }

    const parameters = mergeParameters(
      params,
      processParameterObjects(
        operationObject.parameters as OpenApiV31.ParameterObject[],
      ),
    );

    const operationServerInfo = extractServerInfo(
      operationObject.servers,
      serverInfo,
    );

    const requests = processRequestBodyObjet(
      operationObject.requestBody as OpenApiV31.RequestBodyObject,
      parameters,
      this.locMapper,
      {
        host: operationServerInfo.host,
        port: operationServerInfo.port,
        protocol: operationServerInfo.protocol,
        operationId: operationObject.operationId,
        method,
        path: join(operationServerInfo.basePath, path),
      },
    );
    const responsesAndLinks = processResponsesObject(
      operationObject.responses,
      parameters,
    );

    const securitySchemes = this.globalSecuritySchemes.length
      ? this.globalSecuritySchemes
      : operationObject.security?.length
        ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          operationObject.security.map((sec) => Object.keys(sec)[0]!)
        : [];

    for (const req of requests) {
      const reqId = this.format.addRequest(req);

      for (const { responses, links } of responsesAndLinks) {
        const responseIds: string[] = [];
        for (const res of responses) {
          const [resId] = this.format.addResponseToRequest(reqId, {
            ...res,
            location: operationObject.operationId
              ? this.locMapper.locationForOperationId(
                  operationObject.operationId,
                )
              : undefined,
          });

          responseIds.push(resId);

          securitySchemes.forEach((scheme) => {
            if (typeof this.securitySchemeToNodeId[scheme] === 'string') {
              this.format.addEdge(reqId, this.securitySchemeToNodeId[scheme], {
                type: 'is-secured',
              });
            }
          });
        }

        links.forEach(({ name, linkObj }) => {
          this.linkObjects.push({
            name,
            linkObj,
            responseIds,
          });
        });
      }
    }
  }

  public process(document: OpenApiV31.Document): ThymianFormat {
    const securitySchemes = processSecuritySchemes(
      (document.components?.securitySchemes as Record<
        string,
        OpenApiV31.SecuritySchemeObject
      >) ?? {},
    );

    securitySchemes.forEach((scheme) => {
      this.securitySchemeToNodeId[scheme.extensions.openapi.schemeName] =
        this.format.addSecurityScheme(scheme);
    });

    document.security?.forEach((security) => {
      const name = Object.keys(security)[0];

      if (name) {
        this.globalSecuritySchemes.push(name);
      }
    });

    const serverInfo = extractServerInfo(document.servers, this.options);

    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      if (typeof pathItem === 'undefined') {
        continue;
      }

      const parameters = processParameterObjects(
        pathItem.parameters as OpenApiV31.ParameterObject[] | undefined,
      );

      for (const [method, op] of Object.entries(pathItem)) {
        if (!supportedMethods.includes(method)) {
          continue;
        }

        const operation = op as OpenApiV31.OperationObject;

        const operationParameters = processParameterObjects(
          operation.parameters as OpenApiV31.ParameterObject[],
        );

        this.processOperationObject(
          operation,
          mergeParameters(parameters, operationParameters),
          method,
          path,
          serverInfo,
        );
      }
    }

    this.linkObjects.forEach((linkToProcess) =>
      this.processLinkObject(linkToProcess),
    );

    return this.format;
  }
}
