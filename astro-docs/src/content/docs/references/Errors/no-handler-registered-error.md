---
title: 'NoHandlerRegisteredError'
---

You attempted to emit an action, but no handler is registered for that action name. Actions require at least one handler to be registered when running in `strict` mode.

This error occurs when:

- You misspelled the action name
- The handler registration happens after the action is emitted
- The plugin that provides the handler hasn't been loaded
- You're using an action name that doesn't exist

To fix this:

1. **Verify the action name**: Check for typos in the action name

2. **Ensure handlers are registered before use**:

```typescript
// ❌ Wrong order
await emitter.emitAction('my.action', params);
emitter.onAction('my.action', handler); // Too late!

// ✅ Correct order
emitter.onAction('my.action', handler);
await emitter.emitAction('my.action', params);
```

3. **Check plugin loading**: If the action is provided by a plugin, ensure the plugin is loaded in your configuration

4. **Use the correct action name**: Refer to the documentation for the correct action names

5. **Using the non-strict mode**: You can disable strict mode to allow actions to be emitted without handlers:

```typescript
await emitter.emitAction('my.action', params, {
  strict: false,
});
```

Available core actions can be found in the Thymian documentation. If you're developing a plugin, make sure to register your action handlers during plugin initialization.
