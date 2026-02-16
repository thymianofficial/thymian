---
title: 'WebSocketConnectionTimeoutError'
---

## The Cause

Failed to establish a WebSocket connection with a client within the configured timeout period.

This error occurs when:

- The WebSocket client takes too long to connect
- The client is not running
- The WebSocket port is incorrect or blocked
- Network issues prevent the connection

## The Solution

To resolve this:

1. **Check if the client is running**: Ensure your WebSocket client is started and attempting to connect

2. **Verify the port configuration**: Make sure the client is connecting to the correct WebSocket port

3. **Increase the timeout** if the client legitimately needs more time:

```yaml
plugins:
  '@thymian/websocket-proxy':
    options:
      clientTimeout: 4000 # <-- Increase this timeout (default is 4000 ms)
```

4. **Check network connectivity**: Ensure there are no firewalls or network policies blocking WebSocket connections

5. **Review client logs**: Check your client application for connection errors or issues

The default timeout is usually sufficient for local development. If you're connecting over a network or your client needs additional setup time, consider increasing the `clientTimeout` option.
