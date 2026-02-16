---
title: 'ActionHandlerError'
---

## The Cause

An error occurred while executing an action handler. This error wraps the underlying error that was thrown by your action handler code.

Actions are request-response style operations in Thymian's event system. When an action handler throws an error, it's caught and wrapped to provide context about which action failed.

## The Solution

To debug this error:

1. **Check the error cause**: The original error is available in the `cause` property

2. **Review the action handler**: Look at the handler registered for the action name mentioned in the error

3. **Verify action parameters**: Ensure the action is being called with valid parameters

4. **Add error handling**: Consider adding try-catch blocks in your action handlers

Example of a robust action handler:

```typescript
emitter.onAction('my.action', async (params, ctx) => {
  try {
    // Validate parameters
    if (!params.required) {
      return ctx.error(new Error('Missing required parameter'));
    }

    // Perform action
    const result = await performOperation(params);

    // Reply with result
    ctx.reply(result);
  } catch (error) {
    // Handle errors gracefully
    ctx.error(error);
  }
});
```

The error message will include the action name and source to help you identify which handler is causing the problem.
