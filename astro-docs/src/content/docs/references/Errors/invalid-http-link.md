---
title: 'InvalidHttpLink'
---

An attempt was made to create an HTTP link (edge) between two nodes, but one or both of the nodes (request or response) could not be found in the format.

HTTP links in Thymian connect HTTP responses to HTTP requests, forming a chain of HTTP transactions. This error occurs when trying to link nodes that don't exist.

This is typically an internal error and indicates a bug in the code that's building the Thymian format. If you encounter this error as a user, please report it as a bug with details about what you were trying to do.
