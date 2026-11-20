---
title: 'OpenAPIDereferenceError'
---

## The Cause

Thymian failed to resolve the `$ref` references in your OpenAPI document. This occurs when:

- A `$ref` points to a location that doesn't exist in the document
- A `$ref` points to an external file that doesn't exist
- A `$ref` uses an invalid path or pointer format (e.g., malformed JSON Pointer)
- A `$ref` is circular or contains unresolvable nested references
- The referenced schema or object is missing required fields

For example:

```yaml
# ❌ Invalid: $ref points to non-existent path
components:
  schemas:
    User:
      properties:
        role:
          $ref: '#/components/schemas/InvalidRole' # InvalidRole doesn't exist
```

A `$ref` can also point to another file. Thymian resolves the file path relative to the document that contains the `$ref`, and names the file in the error when it cannot be found:

```yaml
# ❌ Invalid: openapi.yaml references a file that doesn't exist
paths:
  /things:
    get:
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema:
                $ref: './schemas/missing.yaml#/Thing' # schemas/missing.yaml doesn't exist next to openapi.yaml
```

## The Solution

1. **Verify all `$ref` paths exist** - Check that each reference points to an actual component or schema in your document.

   ```yaml
   # ✅ Correct: $ref points to existing schema
   components:
     schemas:
       User:
         properties:
           role:
             $ref: '#/components/schemas/Role' # Role is defined
       Role:
         type: string
         enum: [admin, user, guest]
   ```

2. **Check JSON Pointer syntax** - Ensure `$ref` paths follow the JSON Pointer format:

   ```yaml
   # ✅ Correct patterns:
   $ref: '#/components/schemas/User'
   $ref: '#/components/responses/NotFound'
   $ref: '#/paths/~1users/get' # Use ~1 for / in path segments
   ```

3. **Avoid circular references** - If references form a cycle, use `allOf`, `oneOf`, or `anyOf` to break the cycle:

   ```yaml
   # ❌ Circular (User -> Address -> User)
   # ✅ Better: Break cycle with explicit schema composition
   User:
     type: object
     properties:
       address:
         allOf:
           - $ref: '#/components/schemas/Address'
   ```

4. **Check external file references** - External references are supported. A `$ref` such as `./schemas/user.yaml#/User` is resolved relative to the document that contains the `$ref`, not relative to the current working directory or the root document. Check that the referenced file exists and that its relative path is spelled correctly.

5. **Validate your document** - Use an OpenAPI validator to catch reference errors early:

   ```bash
   thymian validate --spec openapi:openapi.yaml
   ```

If you continue to see this error, enable debug output to see which specific references are failing:

```bash
thymian validate --spec openapi:openapi.yaml --log-level debug
```
