---
title: 'ServerUnavailableError'
---

## The Cause

The server connection was refused. The server at the specified origin is not reachable or not running.

This error occurs when:

- The server is not running
- The server is running on a different port
- A firewall is blocking the connection
- The server address/hostname is incorrect

## The Solution

To resolve this:

1. **Check if the server is running**:

```bash
# Test if the server responds
curl http://localhost:3000
```

2. **Verify the correct port**: Ensure your configuration uses the correct server port

3. **Check firewall settings**: Make sure the port is not blocked

4. **Verify the server address**: Confirm the hostname or IP address is correct

If you're running a local development server, make sure to start it before running Thymian operations that require server access.
