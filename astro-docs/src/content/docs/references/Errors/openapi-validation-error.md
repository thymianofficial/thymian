---
title: 'OpenAPIValidationError'
---

## The Cause

The OpenAPI document failed validation against the OpenAPI 3.x specification. This means the document structure or content does not conform to the OpenAPI standard and cannot be processed.

Common validation issues include:

- **Missing required fields** - Fields like `openapi`, `info`, or `paths` are missing
- **Invalid schema definitions** - Schema objects don't follow the JSON Schema specification
- **Incorrect data types** - Properties have values that don't match their expected types
- **Malformed references** - `$ref` pointers are invalid or point to non-existent definitions
- **Invalid server definitions** - Server objects are missing required properties
- **Incorrect HTTP methods** - Unsupported or misspelled HTTP methods in path definitions

Example of invalid OpenAPI:

```yaml
# ❌ Invalid - missing required 'info' field
openapi: 3.1.0
paths:
  /users:
    get:
      responses:
        '200':
          description: Success

# ✅ Valid - includes all required fields
openapi: 3.1.0
info:
  title: My API
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        '200':
          description: Success
```

## The Solution

### Use the validation command

Thymian provides a validation command that shows detailed error messages:

```bash
thymian openapi:validate path/to/your/openapi.yaml
```

This will output the specific validation errors with line numbers and descriptions.

### Review the OpenAPI specification

Consult the OpenAPI specification to understand the required structure.
