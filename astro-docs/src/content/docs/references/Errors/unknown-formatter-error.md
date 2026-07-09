---
title: 'UnknownFormatterError'
---

## The Cause

You specified a formatter that doesn't exist. Formatters control how Thymian reports are displayed.

Available formatters:

- `markdown` - Markdown format (written to a file)
- `csv` - Comma-separated values (CSV, written to a file)

The CLI also prints a plain-text summary to stdout on every run; that is not a
configurable `plugin-reporter` formatter.

## The Solution

Check your configuration file for typos in the formatter name:

```yaml
# thymian.config.yaml
plugins:
  '@thymian/plugin-reporter':
    options:
      formatters:
        markdown: {} # ✅ Valid
        my-custom: {} # ❌ Unknown formatter
```

If you want to add a custom formatter, you need to create a plugin that listens to the `core.report` event:

```typescript
export default function myFormatterPlugin(emitter) {
  emitter.on('core.report', ({ report }) => {
    // Custom formatting logic
  });
}
```

For more information on creating custom formatters, see the plugin documentation.
