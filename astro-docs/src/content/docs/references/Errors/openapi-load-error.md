---
title: 'OpenAPILoadError'
---

## The Cause

An error occurred while loading, parsing, or dereferencing the OpenAPI document. This can happen for several reasons:

### External References

Currently, Thymian only supports OpenAPI documents without external `$ref` references. If your document uses external references, they must be resolved before loading.

```yaml
# ❌ External reference - not supported
components:
  schemas:
    User:
      $ref: './schemas/user.yaml'

# ✅ Inline definition - supported
components:
  schemas:
    User:
      type: object
      properties:
        name:
          type: string
```

### Invalid OpenAPI Document

The document may not be valid according to the OpenAPI 3.1 specification.

### File System Issues

- The file path may be incorrect
- The file may not be readable
- The file may not be valid YAML/JSON

## The Solution

You can validate your document using:

```bash
thymian openapi:validate path/to/your/openapi.yaml
```

If you're using external references, consider using a tool like [swagger-cli](https://www.npmjs.com/package/swagger-cli) to bundle your OpenAPI document into a single file before using it with Thymian.
