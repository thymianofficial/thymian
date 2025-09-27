import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

export type ServerInfo = {
  port: number;
  host: string;
  protocol: 'http' | 'https';
  basePath: string;
};

export const defaultServerInfo: ServerInfo = {
  basePath: '',
  host: 'localhost',
  port: 8080,
  protocol: 'http',
};

export function extractServerInfo(
  serverObjects: OpenApiV31.ServerObject[] = [],
  defaultInfo: ServerInfo = defaultServerInfo,
): ServerInfo {
  const serverInfo: ServerInfo = {
    ...defaultInfo,
  };

  const localServer =
    serverObjects.find((serverObject) => {
      serverObject.url.includes('localhost');
    }) ?? serverObjects[0];

  if (localServer) {
    const urlWithVariables = localServer.url.replaceAll(
      /\{(.*?)}/g,
      (match, variable) => {
        if (localServer?.variables?.[variable]) {
          return (
            localServer.variables[variable].default ??
            localServer.variables[variable].enum?.[0] ??
            match
          );
        }

        return match;
      },
    );

    try {
      const url = new URL(urlWithVariables);

      serverInfo.host = url.hostname;
      serverInfo.port = url.port
        ? parseInt(url.port)
        : url.protocol === 'https:'
          ? 443
          : 80;
      serverInfo.protocol = url.protocol.replace(
        ':',
        '',
      ) as ServerInfo['protocol'];
      serverInfo.basePath = url.pathname;
    } catch (_) {
      /**/
    }
  }

  return serverInfo;
}
