---
title: 'How to connect remote plugins?'
description: 'This guide is for users who want to run the proxy plugin in Thymian and connect remote plugins via WebSocket.'
sidebar:
  order: 0
---

This guide is for users who want to run the proxy plugin in Thymian and connect remote plugins via WebSocket.

## Overview

The proxy plugin starts a WebSocket server that remote clients can connect to. After a short handshake, a remote plugin can:

- send events to Thymian,
- trigger actions in Thymian and receive results,
- receive events from Thymian, and
- handle actions requested by Thymian and reply.

For protocol details, see the [Plugin Developers Guide](/guides/remote-plugins/how-to-develop-a-remote-plugin/).

## Configuration in Thymian

Register the proxy plugin in your Thymian setup and configure the port and known remote plugins:

```ts
import { Thymian, TextLogger } from '@thymian/core';
import { websocketProxyPlugin } from '@thymian/plugin-websocket-proxy';

const thymian = new Thymian();

thymian.register(websocketProxyPlugin, {
  port: 51234, // optional, default is 51234
  plugins: [
    {
      name: 'remote-plugin',
      token: 'secret-token', // required, unless allowUnauthenticatedPlugins is set
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

### `port` (optional) - Default: 51234

The port of the Websocket server.

### `host` (optional) - Default: `127.0.0.1`

The network interface the WebSocket server binds to. By default the server is only reachable from the machine Thymian runs on, at `ws://127.0.0.1:<port>`. Connect to `127.0.0.1` and not to `localhost`, which can resolve to the IPv6 address `::1` that the server does not listen on.

:::caution
A connected remote plugin has full access to Thymian's event and action bus. Only bind to another interface (for example `0.0.0.0`) on a network you trust. If the host is not a loopback address, `allowUnauthenticatedPlugins` must be disabled, otherwise Thymian does not start. On such a host, a remote plugin must send its token as `Authorization` header to connect at all; only a client that sends one of the `allowedOrigins` as `Origin` header may send the token in its `register` message instead.

This means that with a non-empty `allowedOrigins` on such a host, any peer on the network that sends a listed `Origin` gets a connection without the `Authorization` header and can try a token in its `register` message, one attempt per connection and without a limit on the number of attempts. Leave `allowedOrigins` empty on a host that is reachable from the network unless you need browser clients, and use long random tokens if you do.

The connection is not encrypted (`ws://`), so the token of a remote plugin crosses the network in clear text.
:::

### `allowedOrigins` (optional) - Default: `[]`

List of browser origins (for example `https://tools.example.com`) that are allowed to connect. An entry must be exactly the value the browser sends: scheme, host and port as the browser writes them, in lower case, without a trailing slash and without a path. The port is only part of it if it is not the default port of the scheme (`http://localhost:4200`, but `https://tools.example.com`). A connection attempt that carries an `Origin` header not in this list is rejected with `403 Forbidden`, so that a website opened in a browser on the same machine cannot connect to the server.

The check does not apply to a connection that authenticates with a valid `Authorization: Bearer <token>` header, because a website cannot set that header. If `host` is a loopback address, a client that sends neither an `Origin` nor an `Authorization` header is not affected either. The `Origin` header is not a credential: any client that is not a browser can send an arbitrary value, so this option only protects against websites, and the token remains the only authentication. Some WebSocket libraries send an `Origin` header by default: if such a client does not send the token as header, add its origin to this list or disable the header in the library.

### `allowUnauthenticatedPlugins` (optional) - Default: `false`

Unauthenticated mode for local development. By default only the plugins listed under `plugins` can connect, and each of them needs a `token`. If set to `true`, plugins that are not listed, or that are listed without a `token`, can connect as well. Any process on the same machine can then connect to Thymian, so this is only allowed if `host` is a loopback address.

### `maxPayload` (optional) - Default: `33554432` (32 MiB)

The largest message in bytes the server accepts from a remote plugin. A connection that sends a larger message is closed with code 1009 (Message Too Big). Before a plugin has registered, the limit is 64 KiB.

### `plugins` (optional) - Default: `[]`

List of known remote plugins. Only these plugins can connect, unless `allowUnauthenticatedPlugins` is set. If a plugin with `required: true` is listed, Thymian waits for all required plugins to connect when it starts. Each entry of this list is an object with the following properties:

#### `name` (required)

Unique name of the remote plugin. Used to identify the plugin in the handshake.

#### `token` (required, unless `allowUnauthenticatedPlugins` is set)

A shared secret that authenticates the remote plugin. Use a long random value (at least 16 characters, Thymian warns about shorter tokens): the number of attempts to guess a token is not limited. Thymian does not start if a plugin has no token and `allowUnauthenticatedPlugins` is not set. If a token is set, the remote plugin must send it as `Authorization: Bearer <token>` HTTP header when it opens the WebSocket connection. A connection with an unknown token is rejected with `401 Unauthorized`, and a connection can only register under the name of the plugin its token belongs to. Every plugin needs its own token; Thymian does not start if two plugins share one.

A client that cannot set HTTP headers, such as a plugin running in a browser, sends the token as `token` property of its `register` message instead.

#### `required` (optional) - Default: `false`

If set to `true`, Thymian waits for the plugin to connect before starting.

#### `options` (optional) - Default: `{}`

Options that are sent to the remote plugin during the handshake.

### `clientTimeout` (optional) - Default: 4000

Number of milliseconds a remote plugin has to complete the handshake after it has connected. A connection that is not ready in time is closed; if it belongs to a required plugin, Thymian fails to start with a timeout error.

## Limits

To keep clients without credentials from exhausting the server, at most 64 connections that have not authenticated with an `Authorization` header can be in the handshake at the same time; further ones are rejected with `503 Service Unavailable`. Remote plugins that send their token as `Authorization` header are not affected by this limit. Clients that send the token in the `register` message are: as long as 64 such connections are open and idle, which any process that can reach the server is able to cause, these clients cannot connect. Prefer the header wherever the client can set it.

A connection without `Authorization` header that has not registered yet may only send messages of up to 64 KiB. The server can only enforce this once a message has been received completely, so until then such a connection can make it buffer up to `maxPayload` bytes. With the default of 32 MiB and 64 connections this is about 2 GiB of memory. If remote plugins that are not fully trusted can reach the server, lower `maxPayload` to the largest message your plugins actually send.

## Configuration via Thymian configuration file

The plugin can also be configured via the Thymian configuration file if Thymian is used via its CLI. Thereby all options described above can be used.
