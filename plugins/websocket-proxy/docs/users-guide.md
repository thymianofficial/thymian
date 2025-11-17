# Users Guide

This guide is for users who want to run the proxy plugin in Thymian and connect remote plugins via WebSocket.

## Overview

The proxy plugin starts a WebSocket server that remote clients can connect to. After a short handshake, a remote plugin can:

- send events to Thymian,
- trigger actions in Thymian and receive results,
- receive events from Thymian, and
- handle actions requested by Thymian and reply.

For protocol details, see the [Plugin Developers Guide](./plugin-developers.md).

## Configuration in Thymian

Register the proxy plugin in your Thymian setup and configure the port and known remote plugins:

```ts
import { Thymian, TextLogger } from '@thymian/core';
import { websocketProxyPlugin } from '@thymian/websocket-proxy';

const thymian = new Thymian();

thymian.register(websocketProxyPlugin, {
  port: 45678, // optional, default is 45678
  plugins: [
    {
      name: 'remote-plugin',
      token: 'secret-token', // optional
      required: false, // optional, if set to true, Thymian waits for the plugin to connect before starting
      options: {}, // options that are sent to the remote plugin during the handshake,
    },
  ],
});

await thymian.ready();
// ... application is running, remote plugins can connect

// Shutdown
await thymian.close();
```

The plugin takes an option object with the following properties:

### `port` (optional) - Default: 45678

The port of the Websocket server.

### `plugins` (optional) - Default: `[]`

List of known remote plugins. Each entry of this list is an object with the following properties:

#### `name` (required)

Unique name of the remote plugin. Used to identify the plugin in the handshake.

#### `token` (optional)

If a token is set, it is checked during the handshake, if the corresponding remote plugins sends the same token.

#### `required` (optional) - Default: `false`

If set to `true`, Thymian waits for the plugin to connect before starting.

#### `options` (optional) - Default: `{}`

Options that are sent to the remote plugin during the handshake.

### `clientTimeoutMs` (optional) - Default: 4000

Number of milliseconds to wait for a remote plugin to connect before throwing a timeout error.

## Configuration via Thymian configuration file

The plugin can also be configured via the Thymian configuration file if Thymian is used via its CLI. Thereby all options described above can be used.

## Connecting a remote plugin (user perspective)

For a remote plugin to connect, the external process must:

1. Open a WebSocket connection to `ws://<host>:<port>` (see configuration, default 45678).
2. Send a `register` message, for example:
   ```json
   { "type": "register", "name": "remote-plugin", "onActions": ["core.run"], "onEvents": ["core.report"] }
   ```
3. Wait for `register-ack`. On success (`ok: true`), optionally read the returned `config`.
4. Send `ready`:
   ```json
   { "type": "ready" }
   ```
5. After that, events and actions can flow in both directions.

Important: The order is strict. On violations (e.g. `ready` before `register`, `emit` before `ready`), the server closes the connection with code 1008.

## Minimal example for a remote plugin (Node.js)

```js
import { WebSocket } from 'ws';

const ws = new WebSocket('ws://127.0.0.1:45678');

ws.on('open', () => {
  ws.send(
    JSON.stringify({
      type: 'register',
      name: 'remote-plugin',
      onActions: ['core.run'],
      onEvents: ['core.report'],
    }),
  );
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'register-ack' && msg.ok) {
    ws.send(JSON.stringify({ type: 'ready' }));
  } else if (msg.type === 'event') {
    console.log('Event from Thymian:', msg.name, msg.payload);
  } else if (msg.type === 'action') {
    // Reply to the action
    ws.send(
      JSON.stringify({
        type: 'actionReply',
        correlationId: msg.id,
        name: msg.name,
        payload: { ok: true },
      }),
    );
  }
});

// Send an event to Thymian
function emitReport() {
  ws.send(
    JSON.stringify({
      type: 'emit',
      name: 'core.report',
      payload: { topic: 'A', title: 'B', text: 'C', isProblem: true },
    }),
  );
}
```

A complete reference example is available at `plugins/websocket-proxy/test/reference-client.ts` along with the test `reference-client.test.ts`.

## Troubleshooting

- Connection closes with 1008: Check handshake order (first `register`, then `ready`). Only use actions/events after `ready`.
- No `register-ack` received: Check firewall/network; is the port correct? Is Thymian running and was the plugin registered?
- Actions without a response: Ensure you echo the `correlationId` and send `actionReply`/`actionError`.
- Server shutdown: On shutdown the server closes with code 1001 — the remote plugin should reconnect/restart.

## Stopping/Shutting down

When Thymian stops (`thymian.close()` or by emitting the internal action `core.close`), the proxy plugin closes all connections cleanly (code 1001).
