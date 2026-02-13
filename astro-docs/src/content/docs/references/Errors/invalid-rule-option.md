---
title: 'InvalidRuleOptionError'
---

You provided an invalid option object to a rule. If a rule named `my-rule` defines its options via the following schema:

```json5
{
  type: 'object',
  properties: {
    foo: { type: 'string' },
  },
  additionalProperties: false,
}
```

and you provide the following Thymian configuration file:

```yaml
plugins:
  '@thymian/http-linter':
    options:
      rules:
        'my-rule':
          options:
            bar: baz # should be foo: baz
```

you will receive this error because the provided option object does not conform to the defined schema of the rule options.
