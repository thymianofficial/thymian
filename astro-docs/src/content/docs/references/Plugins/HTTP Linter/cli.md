---
title: 'CLI Reference'
description: 'Command-line tools for managing HTTP linting rules'
---

The HTTP linter provides CLI commands for generating, listing, searching, and managing rules. These commands help you work efficiently with rules during development.

## Commands Overview

| Command    | Purpose                         |
| ---------- | ------------------------------- |
| `generate` | Interactively create a new rule |
| `list`     | Show all loaded rules           |
| `search`   | Find rules by description       |
| `overview` | Display rule statistics         |

## http-linter:generate

Generate a new rule scaffold interactively.

### Usage

```bash
thymian http-linter:generate
```

### Interactive Prompts

The command guides you through rule creation:

1. **Rule name**  Enter a unique identifier
2. **Severity**  Choose: `error`, `warn`, or `hint`
3. **URL**  Optional documentation link
4. **Description**  What the rule validates
5. **Summary**  Optional short description
6. **Rule types**  Select contexts: `static`, `analytics`, `test`, `informational`
7. **Applies to**  Choose participants: `client`, `server`, `proxy`, etc.

### Example Session

```bash
$ thymian http-linter:generate

? What is the name of your rule? post-201-requires-location
? What is the severity of your rule? error
? Url: https://www.rfc-editor.org/rfc/rfc9110.html#status.201
? Description: POST requests returning 201 must include Location header
? Summary:
? What are the types of your rule? static, test
? To which communication participants does this rule apply? Server
```

### Output

The command prints a ready-to-use rule template:

```typescript
import { httpRule } from '@thymian/http-linter';

export default httpRule('post-201-requires-location').severity('error').type('static', 'test').url('https://www.rfc-editor.org/rfc/rfc9110.html#status.201').description('POST requests returning 201 must include Location header').appliesTo('server').done();
```

Copy this into a `.rule.ts` file and add your validation logic.

### Flags

#### `--cjs`

Generate rule for CommonJS instead of ES modules:

```bash
thymian http-linter:generate --cjs
```

Output:

```javascript
const { httpRule } = require('@thymian/http-linter');

module.exports = httpRule('...').severity('error').done();
```

#### `--prefix`

Add a prefix to the rule name:

```bash
thymian http-linter:generate --prefix "mycompany/"
```

When you enter `validate-auth`, the full name becomes `mycompany/validate-auth`.

#### `--url`

Pre-fill the URL field:

```bash
thymian http-linter:generate --url "https://api-guidelines.mycompany.com"
```

## http-linter:list

Display all loaded rules by name.

### Usage

```bash
thymian http-linter:list
```

### Example Output

```
rfc9110/client-must-not-send-content-in-trace-request
rfc9110/server-must-send-www-authenticate-header-for-401-response
rfc9110/post-201-requires-location
mycompany/require-correlation-id
mycompany/validate-api-version
```

### With Custom Rules

Load and list specific rule sources:

```bash
thymian http-linter:list --rules ./my-rules/**/*.rule.ts
```

### With Multiple Sources

```bash
thymian http-linter:list \
  --rules @thymian/rfc-9110-rules \
  --rules ./custom-rules/**/*.rule.ts
```

### Flags

#### `--rules`

Specify rule sources to load (can be used multiple times):

```bash
thymian http-linter:list --rules ./rules/**/*.rule.ts
```

## http-linter:search

Search for rules by description using fuzzy matching.

### Usage

```bash
thymian http-linter:search --for "authentication"
```

### Example Output

```
rfc9110/server-must-send-www-authenticate-header-for-401-response (confidence: 0.12)
  Server generating 401 MUST send WWW-Authenticate header

rfc9110/proxy-must-send-proxy-authenticate-header-for-407-response (confidence: 0.18)
  Proxy generating 407 MUST send Proxy-Authenticate header

mycompany/require-bearer-authentication (confidence: 0.24)
  All protected endpoints must require Bearer token authentication
```

The confidence score shows how well each rule matches your search term (lower is better).

### Search Tips

**Search for HTTP methods:**

```bash
thymian http-linter:search --for "POST"
```

**Search for status codes:**

```bash
thymian http-linter:search --for "401"
```

**Search for headers:**

```bash
thymian http-linter:search --for "Location header"
```

**Search for concepts:**

```bash
thymian http-linter:search --for "caching"
thymian http-linter:search --for "error responses"
```

### Flags

#### `--for`

**Required.** The search term:

```bash
thymian http-linter:search --for "your search term"
```

#### `--rules`

Specify rule sources to search (can be used multiple times):

```bash
thymian http-linter:search \
  --for "authentication" \
  --rules @thymian/rfc-9110-rules \
  --rules ./custom-rules/**/*.rule.ts
```

### Search Algorithm

The search uses [Fuse.js](https://fusejs.io/) with these settings:

- **Fuzzy matching**  Handles typos and variations
- **Threshold: 0.3**  Balanced between precision and recall
- **Searches in:** Rule descriptions
- **Case insensitive**

## http-linter:overview

Display statistics about loaded rules.

### Usage

```bash
thymian http-linter:overview
```

### Example Output

| (index)       | hint | warn | error |
| :------------ | ---: | ---: | ----: |
| static        |    8 |   24 |    18 |
| analytics     |   11 |   26 |    25 |
| test          |    4 |    8 |    13 |
| informational |   20 |   23 |    23 |

138 rules loaded in total.

### Understanding the Output

- **Rows** Rule types (contexts)
- **Columns** Severity levels
- **Values** Number of rules in each category
- **Total** Sum of all rules

Note that rules can appear in multiple rows if they support multiple contexts (e.g., a rule with `.type('static', 'test')` counts in both rows).

### With Custom Rules

```bash
thymian http-linter:overview --rules ./my-rules/**/*.rule.ts
```

## Common Workflows

### Generate and Test a New Rule

```bash
# 1. Generate rule scaffold
thymian http-linter:generate > rules/my-new-rule.rule.ts

# 2. Edit the rule (add validation logic)
vim rules/my-new-rule.rule.ts

# 3. Verify it loads
thymian http-linter:list --rules ./rules/**/*.rule.ts

# 4. Test it
thymian run --rules ./rules/**/*.rule.ts
```

### Find and Inspect Rules

```bash
# 1. Search for rules about a topic
thymian http-linter:search --for "error responses"

# 2. List all available rules
thymian http-linter:list

# 3. Get statistics
thymian http-linter:overview
```

### Audit Rule Coverage

```bash
# See how many rules you have by context and severity
thymian http-linter:overview --rules @mycompany/api-rules
```

Use this to ensure balanced coverage across contexts and identify gaps.

### Compare Rule Sets

```bash
# Your rules
thymian http-linter:overview --rules ./rules/**/*.rule.ts

# Standard rules
thymian http-linter:overview --rules @thymian/rfc-9110-rules

# Combined
thymian http-linter:overview \
  --rules ./rules/**/*.rule.ts \
  --rules @thymian/rfc-9110-rules
```

## Next Steps

- Learn about [creating rules](../../../guides/rules/creating-new-rules.md)
- See [how to use rules](../../../guides/rules/how-to-use-rules.md) in your projects
- Explore [rule types](rule-types.md) for validation contexts
