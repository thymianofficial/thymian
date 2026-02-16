---
title: 'InvalidOpenAPIDocumentError'
---

## The Cause

The provided OpenAPI document failed validation. The document does not conform to the OpenAPI specification.

Common validation issues include:

- Missing required fields (e.g., `openapi`, `info`, `paths`)
- Invalid schema definitions
- Incorrect data types
- Malformed references

## The Solution

To diagnose and fix validation issues, use the validation command:

```bash
thymian openapi:validate path/to/your/openapi.yaml
```

This command will provide detailed error messages about what's wrong with your OpenAPI document.

Once you've identified the issues, fix them in your OpenAPI document and validate again until it passes.
