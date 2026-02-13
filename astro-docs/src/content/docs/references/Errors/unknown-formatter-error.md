---
title: 'UnknownFormatterError'
---

You specified a formatter that doesn't exist. Formatters control how Thymian reports are displayed.

Available formatters:

- `cli` - Command-line output (default)
- `markdown` - Markdown format
- `csv` - Comma-separated values (CSV)

Check your configuration file for typos in the formatter name:

```yaml
# thymian-conf.yml
reporter:
  formatters:
    cli: {} # ✅ Valid
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
