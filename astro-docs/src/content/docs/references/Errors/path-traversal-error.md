---
title: 'PathTraversalError'
---

A security error occurred: the generated path would be outside the base directory. This is a security measure to prevent path traversal attacks.

Thymian sanitizes file paths to ensure they stay within the designated base directory. Paths that attempt to navigate outside this directory using `..` or absolute paths are blocked.

If you encounter this error:

- Check your sample names and paths for invalid characters
- Ensure your hooks and samples don't use absolute paths
- Verify that transaction IDs and other identifiers used in paths are properly sanitized

This error protects against malicious or malformed input that could cause files to be written or read outside the intended directory.
