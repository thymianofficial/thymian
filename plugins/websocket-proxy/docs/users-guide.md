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
