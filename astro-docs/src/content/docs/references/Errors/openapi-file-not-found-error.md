---
title: 'OpenAPIFileNotFoundError'
---

## The Cause

The OpenAPI file could not be found or read. This error occurs during the file resolution phase when Thymian attempts to locate and load the specified OpenAPI document.

Common causes include:

- **File does not exist** - The path you provided doesn't point to an actual file
- **Incorrect path** - The file path is relative but the current working directory is different than expected
- **File permissions** - The file exists but cannot be read due to permission restrictions
- **Invalid file format** - The file is not a valid YAML or JSON file
- **Network issues** - For remote URLs, the file could not be fetched

## The Solution

### Verify the file path

Ensure the file path is correct and the file exists:

```bash
# Check if the file exists
ls -la path/to/your/openapi.yaml

# If using a relative path, verify your working directory
pwd
```

### Use absolute paths

If you're having issues with relative paths, try using an absolute path:

```bash
thymian openapi:validate /absolute/path/to/openapi.yaml
```
