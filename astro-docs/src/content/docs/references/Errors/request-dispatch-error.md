---
title: 'RequestDispatchError'
---

An error occurred while dispatching an HTTP request. This is a general error that wraps the underlying cause of the failure.

Common causes include:

- Network connectivity issues
- DNS resolution failures
- SSL/TLS certificate errors
- Request timeout
- Malformed requests
- Server errors (5xx status codes)

To diagnose the issue:

1. Check the error cause for more specific details
2. Verify network connectivity
3. Test the endpoint manually using curl or a similar tool
4. Check server logs for errors
5. Verify the request parameters are correct

Example debugging with curl:

```bash
curl -v http://your-server/api/endpoint
```

If the request works manually but fails in Thymian, there may be an issue with how the request is being constructed. Check your request configuration and ensure all required headers and parameters are included.
