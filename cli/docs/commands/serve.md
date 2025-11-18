---
title: 'Serve'
---

The serve command runs Thymian as a long‑lived process so that you, your tools, and remote plugins can interact with it continuously. In this mode, Thymian boots the core, loads the configured plugins, and keeps running until you quit the session.
This is the recommended mode when you want to drive Thymian from an external tool, an editor integration, a CI job, or any remote plugin connected via WebSockets.
You can terminate the session at any time by pressing the `q` key in the terminal, or by sending a standard SIGINT (Ctrl+C). Internally, the process also listens for a `core.exit` event. When any plugin emits that event, Thymian shuts down gracefully and exits with the provided code.
This means the lifecycle can be controlled from the keyboard, from scripts that signal the process, or from plugins that decide when the overall task is finished.
In serve mode, all configured plugins are active for the entire lifetime of the process. By default, the WebSocket Proxy Plugin (@thymian/websocket-proxy) is part of the standard configuration, which opens a WebSocket server to accept connections from remote plugins.
Those plugins can be written in any language and can fully control Thymian’s flow by emitting actions and events.

In short, `thymian serve` turns Thymian into a controllable service. You can drive the complete end‑to‑end flow from a remote process—starting runs, reacting to reports, and terminating when done—without ever restarting the CLI, while still preserving the convenience of interactive local control.
