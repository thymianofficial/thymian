---
title: 'Guide for Plugin Developers'
description: 'This guide explains how a remote plugin communicates with Thymian over WebSockets via the plugin @thymian/websocket-proxy.'
---

This guide explains how a remote plugin communicates with Thymian over WebSockets via the plugin `@thymian/websocket-proxy`. The WebSocket server mirrors the `ThymianEmitter API`, i.e.:

- `emit(event, payload)` ↔ message `{ "type": "emit", ... }`
- `emitAction(name, payload, options)` ↔ message `{ "type": "emitAction", ... }` with response `emitActionResult`/`emitActionError`
- `on(event, handler)` ↔ server sends `{ "type": "event", ... }`
- `onAction(name, handler)` ↔ server sends `{ "type": "action", ... }`, the client must answer with `actionReply` or `actionError`

See also ThymianEmitter in `@thymian/core` — this protocol exposes the same surface over WebSockets.

## Connection and handshake

Before a connection can be established, the client must register to the server via a three-way handshake.

1. Connect to WebSocket: `ws://<host>:<port>` (default port is 51234).
2. Register:
   - Client sends once:

     ```json5
     {
       type: 'register',
       token: 's3cr3t', // optional, shared secret
       name: 'remote-plugin', // name of the plugin
       onActions: ['core.run'], // only the actions listed here will be forwarded
       onEvents: ['core.report'], // ...same for events
     }
     ```

     This initial message starts the handshake. It tells the websocket server which plugin tries to connect and which events and actions it wants to receive.

   - Server replies with:
     ```json5
     {
       type: 'register-ack',
       ok: true,
       config: { feature: true, threshold: 3 },
     }
     ```
     The server acknowledges the registration and returns the configuration of the plugin. If the provided token is invalid or if the plugin name is already taken, the server responds with `ok: false`.

3. Send ready:
   After a successful `register-ack`, the client sends:
   ```json5
   { type: 'ready' }
   ```
   The client should send this message AFTER its configuration is done and the plugin is ready to receive events and actions.

:::note
Message order is strict. On violations the connection is closed with code 1008 (Policy Violation).
:::

## Usage

After the handshake, the client can emit and receive events and actions. Therefore, the API of the `ThymianEmitter` is mirrored. In the following, the message types and their use cases are explained.
Each message uses the JSON format and always has a `type` property, that describes the type of the message.

### Emit an event

To emit an event, the client must send a `EmitEventMessage` with the following properties:

- `type`: must be `"emit"`
- `name`: the name of the event to emit
- `payload`: the payload of the event

An example:

```json5
{
  type: 'emit',
  name: 'core.report',
  payload: {
    topic: 'my topic',
  },
}
```

### Emit an action

To emit an action, the client must send a `EmitActionMessage` with the following properties:

- `type`: must be `"emitAction"`
  - `id`: a unique identifier for the action (a UUID is recommended)
- `name`: the name of the action to emit
- `payload`: the payload of the action
- `options`: optional object with the following properties:
  - `strategy`: `"first"` (default) or `"collect"` to collect all replies and `"deep-merge"` to merge all replies into a single payload
  - `timeout`: timeout in milliseconds that is waited for replies

An example:

```json5
{
  type: 'emitAction',
  id: 'C4A22DA0-FDD7-4864-A731-5CBFA1A49834',
  name: 'core.run',
  payload: {},
  options: {
    strategy: 'deep-merge',
    timeout: 10000,
  },
}
```

The plugin will receive a response to the action with either `emitActionResult` or `emitActionError` message.

### Responding to an action

To respond to an action, the server must send an `ActionReplyMessage` with the following properties:

- `type`: must be `"actionReply"`
- `correlationId`: the `id` of the action that was emitted
- `name`: the name of the action that was emitted
- `payload`: the payload of the reply

### Sending an error reply to an action

To send an error reply to an action, the server must send an `ActionErrorMessage` with the following properties:

- `type`: must be `"actionError"`
- `correlationId`: the `id` of the action that was emitted
- `name`: the name of the action that was emitted
- `error`: an object with the following properties:
  - `name`: the name of the error (optional)
  - `message`: the error message (required)
  - `options`: additional options (optional)

### Receiving an event

When the plugin receives an event, the server sends a `EventMessage` with the following properties:

- `type`: must be `"event"`
- `name`: the name of the event
- `payload`: the payload of the event

### Receiving an action

When the plugin receives an action, the server sends a `ActionMessage` with the following properties:

- `type`: must be `"action"`
- `name`: the name of the action
- `payload`: the payload of the action

The client will respond to the action with either `actionReply` or `actionError` message.

### Receiving a reply to an action

When the plugin receives a reply to an action, the server sends a `ActionResultMessage` with the following properties:

- `type`: must be `"emitActionResult"`
- `correlationId`: the `id` of the action that was emitted
- `name`: the name of the action that was emitted
- `payload`: the payload of the reply

### Receiving an error reply to an action

When the plugin receives an error reply to an action, the server sends a `ActionErrorMessage` with the following properties:

- `type`: must be `"emitActionError"`
- `correlationId`: the `id` of the action that was emitted
- `name`: the name of the action that was emitted
- `error`: an object with the following properties:
  - `name`: the name of the error (optional)
  - `message`: the error message (optional)
