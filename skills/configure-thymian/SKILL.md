---
name: configure-thymian
description: Configure thymian for a project by creating and editing the config file. Use this skill when asked to set up thymian, configure thymian, create thymian config, initialize thymian project, or point thymian at an API.
---

# Configure Thymian

## When to use this skill

Use this skill when thymian is not configured yet, when a project needs a new `thymian.config.yaml`, or when an existing config must be updated to point at specifications, traffic, plugins, rule sets, or a target URL.

## Steps

### 1. Identify the project inputs

- Find the API specification file such as `./openapi.yaml`.
- Find any traffic file such as `./traffic.har` if analyze mode is needed.
- Identify the target URL if live testing will be used.

### 2. Create or update the config file

- Prefer `thymian generate config` if starting from scratch.
- Otherwise create or edit `thymian.config.json` in the project root.
- Reference `packages/common-cli/src/thymian-config-schema.ts` for supported fields.

### 3. Configure specifications

- Add a `specifications` entry such as:

```json
{
  "specifications": [{ "type": "openapi", "location": "./openapi.yaml" }]
}
```

### 4. Configure execution settings

- Add `targetUrl` for `thymian test`.
- Add `traffic` for `thymian analyze`.
- Add `ruleSets` such as `@thymian/rules-rfc-9110` and `@thymian/rules-api-description-validation` for linting and testing.
- Add reporter or other plugin settings under `plugins`.

### 6. Refine based on errors

- Fix missing file paths.
- Fix invalid plugin names or options.
- Adjust rule sets, severity thresholds, or reporter output until the config works for the project.

## What NOT to do

- Run any thymian command
- change any other file than the thymian config file
