import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  STATUS_CODES,
} from 'node:http';
import type { Duplex } from 'node:stream';

import {
  type EventPayload,
  type Logger,
  stringifyRedacted,
  type ThymianActionName,
  ThymianBaseError,
  ThymianEmitter,
  type ThymianEventName,
  type ThymianEvents,
  timeoutPromise,
} from '@thymian/core';
import sjson from 'secure-json-parse';
import { type ServerOptions, type WebSocket, WebSocketServer } from 'ws';

import { isClientToServerMessage } from './message-schemas.js';
import type {
  ActionErrorMessage,
  ActionReplyMessage,
  ClientToServerMessage,
  ServerActionMessage,
  ServerEventMessage,
  ServerToClientMessage,
} from './messages.js';

export type WebsocketProxyPlugin = {
  name: string;
  required?: boolean;
  token?: string;
  options: Record<PropertyKey, unknown>;
};

export type WebSocketProxyServerOptions = {
  port: number;
  /**
   * Interface the server binds to. Defaults to the loopback interface, so the
   * bus is only reachable from the local machine.
   */
  host: string;
  /**
   * Browser origins that may open a connection. Any handshake carrying an
   * `Origin` header that is not listed here (exact match) is rejected, unless
   * it carries a valid bearer token.
   */
  allowedOrigins: string[];
  /**
   * Unauthenticated mode for local development: accept plugins that are not
   * listed under `plugins`, and listed plugins without a token. Off by
   * default, and refused on a host that is not a loopback address.
   */
  allowUnauthenticatedPlugins: boolean;
  /** Largest message, in bytes, the server accepts from a client. */
  maxPayload: number;
  clientTimeout: number;
  plugins: WebsocketProxyPlugin[];
};

export const DEFAULT_MAX_PAYLOAD = 32 * 1024 * 1024;

/** Largest message accepted from a connection that has not registered yet. */
const MAX_UNREGISTERED_MESSAGE_BYTES = 64 * 1024;
/** Connections that may be in the handshake (not yet ready) at the same time. */
const MAX_PENDING_HANDSHAKES = 64;
/** Time a peer gets to answer a close frame before its socket is destroyed. */
const CLOSE_GRACE_MS = 1000;
/** Tokens shorter than this are reported as weak when the server starts. */
const RECOMMENDED_TOKEN_LENGTH = 16;

type RejectionStatus = 401 | 403 | 503;

type UpgradeDecision =
  | { ok: true; plugin?: WebsocketProxyPlugin }
  | { ok: false; status: RejectionStatus; reason: string };

type PendingAction = {
  client: ConnectedClient;
  name: ThymianActionName;
  onResponse: (msg: ActionReplyMessage | ActionErrorMessage) => void;
};

const REGISTRATION_REJECTED = 'Unknown plugin or invalid token.';

function isLoopbackHost(host: string): boolean {
  return (
    host === 'localhost' || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host)
  );
}

/** Peer-controlled text for a log line: bounded and without control characters. */
function printable(value: string): string {
  return JSON.stringify(value.length > 128 ? `${value.slice(0, 128)}…` : value);
}

function byteLength(data: Buffer | ArrayBuffer | Buffer[]): number {
  if (Array.isArray(data)) {
    return data.reduce((sum, chunk) => sum + chunk.length, 0);
  }

  return data.byteLength;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Constant-time string comparison (hashing first equalises the lengths). */
function tokensMatch(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

export type ConnectedClient = {
  name: string;
  ws: WebSocket;
  state: 'connected' | 'registered' | 'ready' | 'closed';
  events: ThymianEventName[];
  actions: ThymianActionName[];
};

export class WebSocketProxyServer {
  private readonly options: WebSocketProxyServerOptions;
  private readonly required: Set<string>;
  /** Clients that completed the handshake, by plugin name. */
  private readonly clients = new Map<string, ConnectedClient>();
  /** Names claimed by a connection, from `register` until the socket closes. */
  private readonly claimedNames = new Set<string>();
  /**
   * Emitter subscriptions cannot be removed, so they are made once per plugin
   * name and routed to whichever client currently holds that name.
   */
  private readonly subscriptions = new Map<
    string,
    { actions: Set<ThymianActionName>; events: Set<ThymianEventName> }
  >();
  private httpServer!: Server;
  private wss!: WebSocketServer;
  private readonly pendingActionCtx = new Map<string, PendingAction>();
  /** Sockets that are connected but not ready yet. */
  private readonly handshaking = new Set<WebSocket>();

  constructor(
    private readonly emitter: ThymianEmitter,
    private readonly logger: Logger,
    options: Partial<WebSocketProxyServerOptions> = {},
  ) {
    this.options = {
      port: 51234,
      host: '127.0.0.1',
      allowedOrigins: [],
      allowUnauthenticatedPlugins: false,
      maxPayload: DEFAULT_MAX_PAYLOAD,
      plugins: [],
      clientTimeout: 4000,
      // an explicit null/undefined (e.g. an empty YAML value) must not
      // replace a safe default
      ...Object.fromEntries(
        Object.entries(options).filter(([, value]) => value != null),
      ),
    };
    // a null token (an empty YAML value) means "no token"
    this.options.plugins = this.options.plugins.map(({ token, ...plugin }) =>
      token == null ? plugin : { ...plugin, token },
    );
    this.required = new Set(
      this.options.plugins.filter((p) => !!p.required).map((p) => p.name),
    );

    this.assertSafeConfiguration();
  }

  /**
   * Refuses configurations that would silently leave the bus unprotected.
   */
  private assertSafeConfiguration(): void {
    const { plugins, host, allowUnauthenticatedPlugins } = this.options;
    const configError = (message: string, suggestion: string) =>
      new ThymianBaseError(message, {
        name: 'WebSocketProxyConfigurationError',
        suggestions: [suggestion],
      });

    if (typeof host !== 'string' || host === '') {
      throw configError(
        'The "host" of @thymian/plugin-websocket-proxy must be a non-empty string.',
        'Remove the "host" option to bind to 127.0.0.1.',
      );
    }

    const names = plugins.map((p) => p.name);

    if (new Set(names).size !== names.length) {
      throw configError(
        'Two or more remote plugins are configured with the same name.',
        'Give every plugin under "plugins" of @thymian/plugin-websocket-proxy a unique name.',
      );
    }

    for (const plugin of plugins) {
      if (plugin.name === '') {
        throw configError(
          'A remote plugin is configured with an empty name.',
          'Give every plugin under "plugins" of @thymian/plugin-websocket-proxy a name.',
        );
      }

      // an empty token must not be mistaken for "no token configured"
      if (plugin.token === '') {
        throw configError(
          `The token of remote plugin "${plugin.name}" is empty.`,
          'Set a non-empty token or remove the "token" property.',
        );
      }
    }

    // Without a token any peer that can connect may claim the plugin's name.
    // Unauthenticated plugins therefore need the explicit opt-in.
    const withoutToken = plugins.filter((p) => p.token === undefined);

    if (withoutToken.length > 0 && !allowUnauthenticatedPlugins) {
      throw configError(
        `No token is configured for the remote plugin${withoutToken.length > 1 ? 's' : ''} ${withoutToken.map((p) => `"${p.name}"`).join(', ')}.`,
        'Configure a token for every remote plugin. For local development without authentication, set "allowUnauthenticatedPlugins" to true.',
      );
    }

    // Reachable from the network: every connection must be authenticated.
    if (allowUnauthenticatedPlugins && !isLoopbackHost(host)) {
      throw configError(
        `@thymian/plugin-websocket-proxy is bound to "${host}", which is reachable from the network, but "allowUnauthenticatedPlugins" is enabled.`,
        'Disable "allowUnauthenticatedPlugins" and configure a token for every remote plugin, or bind to 127.0.0.1.',
      );
    }

    // A bearer token identifies exactly one plugin, so tokens must be unique.
    const tokens = plugins.flatMap((p) => p.token ?? []);

    if (new Set(tokens).size !== tokens.length) {
      throw new ThymianBaseError(
        'Two or more remote plugins are configured with the same token.',
        {
          name: 'WebSocketProxyConfigurationError',
          suggestions: [
            'Give every plugin under "plugins" of @thymian/plugin-websocket-proxy its own token.',
          ],
        },
      );
    }
  }

  start(): Promise<void> {
    for (const plugin of this.options.plugins) {
      if (
        plugin.token !== undefined &&
        plugin.token.length < RECOMMENDED_TOKEN_LENGTH
      ) {
        this.logger.warn(
          `The token of remote plugin "${plugin.name}" is shorter than ${RECOMMENDED_TOKEN_LENGTH} characters. Use a long random value, the number of attempts to guess it is not limited.`,
        );
      }
    }

    // Authentication happens on the HTTP upgrade request, before a WebSocket
    // exists: a rejected peer never gets to speak the plugin protocol.
    // `closeTimeout` is supported by ws but missing from its type definitions.
    // It applies to every close: a peer that does not answer the close frame
    // is disconnected after the grace period.
    const serverOptions: ServerOptions & { closeTimeout: number } = {
      noServer: true,
      maxPayload: this.options.maxPayload,
      closeTimeout: CLOSE_GRACE_MS,
    };
    this.wss = new WebSocketServer(serverOptions);
    this.httpServer = createServer((_, res) => {
      res.writeHead(426, { Connection: 'close' }).end();
    });

    this.httpServer.on('upgrade', (req, socket, head) => {
      let decision = this.authenticateUpgrade(req);

      // The cap only applies to connections without valid credentials, so
      // that anonymous peers cannot lock authenticated plugins out.
      if (
        decision.ok &&
        !decision.plugin &&
        this.handshaking.size >= MAX_PENDING_HANDSHAKES
      ) {
        decision = {
          ok: false,
          status: 503,
          reason:
            'too many unauthenticated connections are waiting to register.',
        };
      }

      if (!decision.ok) {
        this.logger.warn(
          `Rejected WebSocket connection from ${req.socket.remoteAddress}: ${decision.reason}`,
        );
        this.rejectUpgrade(socket, decision.status);
        return;
      }

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req, decision.plugin);
      });
    });

    const listening = new Promise<void>((resolve, reject) => {
      this.httpServer.once('error', reject);
      this.httpServer.listen(this.options.port, this.options.host, () => {
        this.httpServer.off('error', reject);
        this.httpServer.on('error', (err) => {
          this.logger.error(`WebSocket server error: ${err.message}`);
        });
        this.logger.debug(
          `@thymian/plugin-websocket-proxy listening on ws://${this.options.host}:${this.options.port}`,
        );
        resolve();
      });
    });

    const clientsReady = new Promise<void>((resolve, reject) => {
      this.wss.on(
        'connection',
        async (
          ws: WebSocket,
          _req: IncomingMessage,
          authenticatedAs?: WebsocketProxyPlugin,
        ) => {
          const client: ConnectedClient = {
            name: '',
            ws,
            state: 'connected',
            events: [],
            actions: [],
          };

          // only anonymous connections count towards the handshake cap
          if (!authenticatedAs) {
            this.handshaking.add(ws);
            ws.once('close', () => this.handshaking.delete(ws));
          }

          try {
            const connectedClient = await timeoutPromise(
              this.onConnection(client, authenticatedAs),
              this.options.clientTimeout,
              new ThymianBaseError(
                `Cannot establish a connection to a WebSocket client within ${this.options.clientTimeout}ms.`,
                {
                  name: 'WebSocketConnectionTimeoutError',
                  ref: 'https://thymian.dev/references/errors/websocket-connection-timeout-error/',
                  suggestions: [
                    'Check if the client is running and if the port is correct.',
                    'Increase the clientTimeout option if the client takes longer to connect.',
                  ],
                },
              ),
            );

            this.handshaking.delete(ws);
            this.logger.debug(
              `Plugin ${printable(connectedClient.name)} connected.`,
            );

            // every required plugin is ready; other plugins may be connected too
            if ([...this.required].every((name) => this.clients.has(name))) {
              for (const [, client] of this.clients) {
                if (client.state !== 'ready') {
                  this.logger.warn(
                    `Client ${printable(client.name)} is not ready. Connection to Websocket is closed with state ${client.state}.`,
                  );
                }
              }

              resolve();
            }
          } catch (err) {
            // A connection that was already closed (e.g. a rejected
            // registration) must not fail the startup of Thymian.
            if (ws.readyState !== ws.OPEN) {
              return;
            }

            // The deadline is final: later messages are refused, and a peer
            // that ignores the close frame is disconnected.
            client.state = 'closed';
            this.closeSocket(ws, 1008, 'Handshake not completed in time.');

            // Only a required plugin that stalls fails the startup; an
            // anonymous connection that never registers must not be able to.
            // The plugin is known from the credentials or from `register`.
            if (this.required.has(authenticatedAs?.name ?? client.name)) {
              reject(err);
            } else {
              this.logger.warn(
                `Closed a WebSocket connection that did not complete the handshake within ${this.options.clientTimeout}ms.`,
              );
            }
          }
        },
      );

      if (this.required.size === 0) {
        resolve();
      }
    });

    return Promise.all([listening, clientsReady]).then(() => undefined);
  }

  /**
   * Decides whether an HTTP upgrade request may become a WebSocket.
   *
   * - An `Authorization: Bearer <token>` header must match the token of a
   *   configured plugin; the connection is then bound to that plugin.
   * - Without the header the connection is unauthenticated: it still has to
   *   present a token in `register`, and a browser `Origin` that is not
   *   allow-listed is rejected (a web page can otherwise reach a loopback
   *   server).
   * - On a host that is reachable from the network the header is mandatory,
   *   except for a browser client from an allow-listed origin.
   */
  private authenticateUpgrade(req: IncomingMessage): UpgradeDecision {
    const authorization = req.headers.authorization;

    if (authorization !== undefined) {
      const token = /^Bearer +(\S+)$/i.exec(authorization.trim())?.[1];
      let plugin: WebsocketProxyPlugin | undefined;

      if (token !== undefined) {
        // compare against every token, so timing does not reveal which matched
        for (const candidate of this.options.plugins) {
          if (
            candidate.token !== undefined &&
            tokensMatch(token, candidate.token)
          ) {
            plugin = candidate;
          }
        }
      }

      // A valid token is sufficient on its own: a web page cannot set the
      // Authorization header of a WebSocket handshake, so this is no browser,
      // even if the client library sends an Origin header.
      return plugin
        ? { ok: true, plugin }
        : { ok: false, status: 401, reason: 'invalid credentials.' };
    }

    const origin = req.headers.origin;

    if (origin !== undefined && !this.options.allowedOrigins.includes(origin)) {
      return {
        ok: false,
        status: 403,
        reason: `origin ${printable(origin)} is not allowed.`,
      };
    }

    // Reachable from the network: no WebSocket without credentials. The only
    // exception is a browser client from an allowed origin, which cannot set
    // the header and has to present its token in `register`.
    if (origin === undefined && !isLoopbackHost(this.options.host)) {
      return { ok: false, status: 401, reason: 'credentials are required.' };
    }

    return { ok: true };
  }

  /**
   * Sends a close frame and destroys the socket if the peer does not complete
   * the close handshake.
   */
  private closeSocket(ws: WebSocket, code: number, reason: string): void {
    const timer = setTimeout(() => ws.terminate(), CLOSE_GRACE_MS);
    timer.unref();
    ws.once('close', () => clearTimeout(timer));

    if (ws.readyState === ws.OPEN) {
      ws.close(code, reason);
    }
  }

  private rejectUpgrade(socket: Duplex, status: RejectionStatus): void {
    socket.on('error', () => undefined);
    // end() only half-closes: without destroy() a peer that keeps its side
    // open would hold the socket forever and block the shutdown.
    const timer = setTimeout(() => socket.destroy(), CLOSE_GRACE_MS);
    timer.unref();
    socket.once('close', () => clearTimeout(timer));
    socket.once('finish', () => socket.destroy());
    socket.end(
      `HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\n` +
        (status === 401 ? 'WWW-Authenticate: Bearer\r\n' : '') +
        'Connection: close\r\nContent-Length: 0\r\n\r\n',
    );
  }

  stop(): Promise<void> {
    this.logger.debug('Shutting down WebSocket server.');

    return new Promise((resolve, reject) => {
      if (!this.wss) {
        return resolve();
      }

      // every open socket, including ones that never finished the handshake
      // a peer that does not answer the close frame must not delay shutdown
      for (const ws of this.wss.clients) {
        this.closeSocket(ws, 1001, 'Server shutting down.');
      }
      this.clients.clear();
      this.claimedNames.clear();
      this.wss.close();

      if (!this.httpServer.listening) {
        return resolve();
      }

      // connections that never became a WebSocket
      const timer = setTimeout(
        () => this.httpServer.closeAllConnections(),
        CLOSE_GRACE_MS,
      );
      timer.unref();

      this.httpServer.close((err) => {
        clearTimeout(timer);

        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private onConnection(
    connectedClient: ConnectedClient,
    authenticatedAs?: WebsocketProxyPlugin,
  ): Promise<ConnectedClient> {
    const ws = connectedClient.ws;
    let emitter = this.emitter;
    // set once this connection holds its name in `claimedNames`
    let claimedName = false;

    /** `detail` is only logged, the client gets the generic `reason`. */
    const rejectRegistration = (reason: string, detail = reason) => {
      this.logger.warn(`Rejected registration of a remote plugin: ${detail}`);
      this.sendMessageForClient(connectedClient, {
        type: 'register-ack',
        ok: false,
        reason,
      });
      ws.close(1008, reason);
      connectedClient.state = 'closed';
    };

    // Without a listener a protocol error of a single client (an oversized
    // message, an invalid frame) is an uncaught exception that ends Thymian.
    // ws closes the connection itself, the 'close' handler does the cleanup.
    ws.on('error', (err) => {
      this.logger.warn(
        `WebSocket error${connectedClient.name ? ` for plugin ${printable(connectedClient.name)}` : ''}: ${err.message}. Closing socket connection.`,
      );
    });

    ws.on('close', () => {
      connectedClient.state = 'closed';

      if (!claimedName) {
        return;
      }

      this.claimedNames.delete(connectedClient.name);

      if (this.clients.get(connectedClient.name) === connectedClient) {
        this.clients.delete(connectedClient.name);
      }

      // the plugin can no longer answer: fail its open actions right away
      // instead of letting the callers run into their timeout
      for (const [id, pending] of this.pendingActionCtx) {
        if (pending.client === connectedClient) {
          pending.onResponse({
            type: 'actionError',
            correlationId: id,
            name: pending.name,
            error: {
              name: 'RemotePluginDisconnectedError',
              message: `Remote plugin ${printable(connectedClient.name)} disconnected before replying to action "${pending.name}".`,
            },
          });
        }
      }
    });

    return new Promise((resolve) => {
      ws.on('message', async (rawMessage) => {
        // a peer that has not identified itself only needs to send `register`
        if (
          connectedClient.state === 'connected' &&
          byteLength(rawMessage) > MAX_UNREGISTERED_MESSAGE_BYTES
        ) {
          this.logger.warn(
            'Received an oversized message before registration. Closing socket connection.',
          );
          ws.close(1009, 'Message too big.');
          connectedClient.state = 'closed';
          return;
        }

        const stringMessage = rawMessage.toString();

        let message!: ClientToServerMessage;

        try {
          const parsed = sjson.parse(stringMessage);

          if (!isClientToServerMessage(parsed)) {
            this.logger.warn(
              'Received invalid JSON message. Closing socket connection.',
            );
            ws.close(1008, 'Received invalid message.');
            connectedClient.state = 'closed';
            return;
          }

          message = parsed;

          // never write a token to the log
          this.logger.trace(
            `Received message: ${
              message.type === 'register' && message.token !== undefined
                ? JSON.stringify({ ...message, token: '[REDACTED]' })
                : stringMessage
            }`,
          );
        } catch {
          // the parser's error text can quote the input, which may hold a token
          this.logger.error(
            'Received a message that is not valid JSON. Closing socket connection.',
          );

          ws.close(1003);
          connectedClient.state = 'closed';
          return;
        }

        switch (message.type) {
          case 'register': {
            if (connectedClient.state !== 'connected') {
              this.logger.warn(
                `Received register message in state '${connectedClient.state}'. Expected to be in state 'connected'. Connection to Websocket is closed.`,
              );
              ws.close(1003, 'Received invalid JSON message.');
              connectedClient.state = 'closed';
              return;
            }

            this.logger.debug(
              `Received register message from plugin ${printable(message.name)}.`,
            );

            // Nothing below changes the connection state until every check
            // has passed; a failed check closes the socket.
            let config: WebsocketProxyPlugin | undefined;

            if (authenticatedAs) {
              // identity comes from the handshake credentials, not the message
              if (message.name !== authenticatedAs.name) {
                return rejectRegistration(
                  'Plugin name does not match the provided credentials.',
                );
              }

              config = authenticatedAs;
            } else {
              config = this.options.plugins.find(
                (p) => p.name === message.name,
              );

              if (!config && !this.options.allowUnauthenticatedPlugins) {
                return rejectRegistration(
                  REGISTRATION_REJECTED,
                  `unknown plugin ${printable(message.name)}.`,
                );
              }

              if (config?.token !== undefined) {
                if (
                  message.token === undefined ||
                  !tokensMatch(message.token, config.token)
                ) {
                  return rejectRegistration(
                    REGISTRATION_REJECTED,
                    `invalid token for plugin ${printable(message.name)}.`,
                  );
                }

                this.logger.debug(
                  `Plugin ${printable(message.name)} sent its token in the register message. Clients that can set HTTP headers should send it as "Authorization: Bearer <token>" header instead.`,
                );
              }
            }

            if (this.claimedNames.has(message.name)) {
              return rejectRegistration('Name already in use.');
            }

            this.claimedNames.add(message.name);
            claimedName = true;
            connectedClient.actions = message.onActions ?? [];
            connectedClient.events = message.onEvents ?? [];
            connectedClient.name = message.name;
            connectedClient.state = 'registered';

            this.sendMessageForClient(connectedClient, {
              type: 'register-ack',
              ok: true,
              config: config?.options ?? {},
            });

            break;
          }
          case 'ready': {
            if (connectedClient.state !== 'registered') {
              const errMsg = `Received ready message in state '${connectedClient.state}'. Expected to be in state 'registered'. Connection to Websocket is closed.`;
              this.logger.warn(errMsg);
              ws.close(1008, errMsg);
              connectedClient.state = 'closed';
              return;
            }
            emitter = this.emitter.child(connectedClient.name);
            this.registerEventsAndActionsForClient(connectedClient);

            connectedClient.state = 'ready';
            this.clients.set(connectedClient.name, connectedClient);

            return resolve(connectedClient);
          }
          case 'emit': {
            if (connectedClient.state !== 'ready') {
              const errorMsg = `Received emit message in state '${connectedClient.state}'. Expected to be in state 'ready'. Connection to Websocket is closed.`;
              this.logger.warn(errorMsg);
              ws.close(1008, errorMsg);
              connectedClient.state = 'closed';
              return;
            }

            emitter.emit(
              message.name,
              message.payload as EventPayload<keyof ThymianEvents>,
            );
            break;
          }
          case 'emitAction': {
            if (connectedClient.state !== 'ready') {
              const errorMsg = `Received emit message in state '${connectedClient.state}'. Expected to be in state 'ready'. Connection to Websocket is closed.`;
              this.logger.warn(errorMsg);
              ws.close(1008, errorMsg);
              connectedClient.state = 'closed';
              return;
            }

            const { id, name, payload, options } = message;
            try {
              const result = await emitter.emitAction(
                name,
                payload as never,
                options,
              );

              this.sendMessageForClient(connectedClient, {
                type: 'emitActionResult',
                correlationId: id,
                name,
                payload: result,
              });
            } catch (e) {
              if (e instanceof Error) {
                this.sendMessageForClient(connectedClient, {
                  type: 'emitActionError',
                  correlationId: id,
                  name,
                  error: {
                    name: e?.name ?? 'Error',
                    message: e?.message ?? 'Action failed',
                  },
                });
              } else {
                this.sendMessageForClient(connectedClient, {
                  type: 'emitActionError',
                  correlationId: id,
                  name,
                  error: {},
                });
              }
            }

            break;
          }
          case 'actionReply':
          case 'actionError': {
            const pending = this.pendingActionCtx.get(message.correlationId);

            // only the client the action was sent to may answer it
            if (pending?.client === connectedClient) {
              pending.onResponse(message);
            } else {
              this.logger.warn(
                `Ignoring ${message.type} for an action that was not sent to this client.`,
              );
            }

            break;
          }
          default: {
            const m = message as { type: string };

            const msg = `Received invalid message type "${m.type}".`;
            ws.close(1008, msg);
            this.logger.warn(msg);
            connectedClient.state = 'closed';
            return;
          }
        }
      });
    });
  }

  private sendMessageForClient(
    connectedClient: ConnectedClient,
    data: ServerToClientMessage,
  ) {
    const stringifiedData = JSON.stringify(data);

    // the plugin options in a register-ack can hold credentials
    this.logger.trace(
      `Sending message: ${data.type === 'register-ack' ? stringifyRedacted(data) : stringifiedData}`,
    );

    connectedClient.ws.send(stringifiedData, (err) => {
      if (err) {
        this.logger.error(
          `Error sending message: ${err.message}. Closing socket connection.`,
        );

        connectedClient.ws.close(1002);
        connectedClient.state = 'closed';
      }
    });
  }

  private registerEventsAndActionsForClient(client: ConnectedClient): void {
    const emitter = this.emitter.child(client.name);
    const pluginName = client.name;

    let subscribed = this.subscriptions.get(pluginName);

    if (!subscribed) {
      subscribed = { actions: new Set(), events: new Set() };
      this.subscriptions.set(pluginName, subscribed);
    }

    for (const name of client.actions) {
      if (subscribed.actions.has(name)) {
        continue;
      }
      subscribed.actions.add(name);

      emitter.onAction(name, async (payload, ctx) => {
        const current = this.clients.get(pluginName);

        if (current?.state !== 'ready' || !current.actions.includes(name)) {
          this.logger.debug(
            `Plugin ${printable(pluginName)} is not connected, action "${name}" is not forwarded.`,
          );
          return;
        }

        const id = randomUUID();

        const onResponse = (msg: ActionReplyMessage | ActionErrorMessage) => {
          this.pendingActionCtx.delete(id);

          if (msg.type === 'actionReply') {
            ctx.reply(msg.payload as never);
          } else {
            ctx.error(msg.error);
          }
        };

        this.pendingActionCtx.set(id, { client: current, name, onResponse });

        const message: ServerActionMessage = {
          type: 'action',
          id,
          name,
          payload,
        };

        this.sendMessageForClient(current, message);
      });
    }

    for (const name of client.events) {
      if (subscribed.events.has(name)) {
        continue;
      }
      subscribed.events.add(name);

      emitter.on(name, (payload) => {
        const current = this.clients.get(pluginName);

        if (current?.state !== 'ready' || !current.events.includes(name)) {
          return;
        }

        const message: ServerEventMessage = {
          type: 'event',
          name,
          payload,
        };

        this.sendMessageForClient(current, message);
      });
    }
  }
}
