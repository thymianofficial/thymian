---
name: debug-event-communication
description: "Debug Thymian's RxJS-based event system. USE WHEN analyzing event flow issues, investigating missing responses, debugging action/event handlers, tracing event communication between plugins, or when tests fail due to event system problems. EXAMPLES: 'event not received', 'action timeout', 'no response from handler', 'plugin communication broken', 'correlation ID mismatch', 'event listener not triggered'."
---

# Debug Event Communication

This skill helps debug and analyze Thymian's event-driven architecture based on RxJS Subjects and ThymianEmitter.

## Thymian Event System Architecture

### Core Components

**ThymianEmitter** (`packages/core/src/emitter/thymian-emitter.ts`):

- Central event bus using RxJS `Subject` streams
- Three internal subjects:
  - `#events`: Regular events and action events (fire-and-forget + request-response)
  - `#responses`: Response events from action handlers
  - `#errors`: Error events with correlation support
- Each emitter has a `source` identifier (typically plugin name)
- Child emitters share the same subject instances but have different sources

### Event Types

1. **ThymianEvent** (Fire-and-Forget):
   - Structure: `{ id, name, payload, timestamp, source }`
   - Registered with: `emitter.on(eventName, handler)`
   - Emitted with: `emitter.emit(eventName, payload)`
   - Examples: `core.error`, `core.register`, `core.report`, `core.exit`
   - No response expected, handler errors are caught and emitted as error events

2. **ThymianActionEvent** (Request-Response):
   - Structure: `{ id, name, payload, timestamp, source }`
   - Registered with: `emitter.onAction(actionName, (payload, ctx) => { ctx.reply(response) })`
   - Emitted with: `await emitter.emitAction(actionName, payload, options)`
   - Examples: `core.ready`, `core.close`, `core.format.load`, `core.lint`, `core.test`, `core.analyze`, `core.report.flush`
   - Waits for response(s) from handler(s) with timeout
   - Strategies: `'first'`, `'collect'` (default), `'deep-merge'`

3. **ThymianResponseEvent**:
   - Structure: `{ id, name, correlationId, payload, timestamp, source }`
   - Created by calling `ctx.reply(payload)` in action handler
   - `correlationId` links response to original action event's `id`

4. **ThymianErrorEvent**:
   - Structure: `{ id, name, error, timestamp, source, correlationId? }`
   - Created by calling `ctx.error(err)` or thrown errors in handlers
   - Can be correlated to events/actions via `correlationId`

### Key Mechanisms

- **Correlation**: Response events contain `correlationId` matching the action event's `id`
- **Timeout**: Default 1000ms, configurable per action via `options.timeout`
- **Listener Tracking**: `#listeners` Map tracks number of registered handlers per action
- **Response Collection**: `emitAction` waits for N responses (N = number of listeners)
- **Error Handling**: All handler errors are caught and emitted as error events
- **Tracing**: Enable via `traceEvents: true` in constructor options

## Common Event Communication Issues

### 1. Action Timeout / No Response

**Symptoms**:

- `emitAction` hangs or times out
- Warning: "No response event received for action X within Yms"

**Root Causes**:

- Handler forgot to call `ctx.reply()` or `ctx.error()`
- Handler threw error before calling `ctx.reply()`
- Timeout too short for async operations
- No handler registered (check `strict` option)

**Debug Steps**:

```typescript
// Check if handler is registered
emitter.onAction('my.action', (payload, ctx) => {
  console.log('Handler called with:', payload);
  // MUST call ctx.reply() or ctx.error()
  ctx.reply(result);
});

// Check timeout and enable tracing
const result = await emitter.emitAction('my.action', data, {
  timeout: 5000, // Increase timeout
  strict: true, // Fail if no handler registered
});

// Enable event tracing in emitter constructor
const emitter = new ThymianEmitter(logger, state, {
  traceEvents: true, // Logs all events
  timeout: 5000,
});
```

### 2. Missing Event / Listener Not Triggered

**Symptoms**:

- Event handler never executes
- Expected side effects don't occur

**Root Causes**:

- Listener registered after event was emitted (race condition)
- Event name typo (string literal mismatch)
- Handler subscribed on different emitter instance
- Subject already completed

**Debug Steps**:

```typescript
// Verify event name matches exactly
emitter.on('core.register', (payload) => {
  console.log('Received event:', payload);
});

// Check registration order - listeners MUST be registered before emit
emitter.on('my.event', handler); // Register first
emitter.emit('my.event', data); // Emit second

// Verify using same emitter instance (or child of same instance)
const childEmitter = emitter.child('plugin-name');
childEmitter.on('event', handler); // Shares same #events subject
```

### 3. Correlation ID Mismatch

**Symptoms**:

- Response not linked to action
- Wrong response received

**Root Causes**:

- Handler called `ctx.reply()` multiple times
- Multiple action emissions without awaiting
- `correlationId` manually modified

**Debug Steps**:

```typescript
// Each emitAction creates unique event.id
const actionEventId = randomUUID(); // Auto-generated in emitAction

// Response MUST use correlationId from action
emitter.onAction('my.action', (payload, ctx) => {
  // ctx.reply automatically sets correlationId
  ctx.reply(result);
});

// Check error events for correlation
emitter.onError((errorEvent) => {
  console.log('Error correlation:', errorEvent.correlationId);
});
```

### 4. Multiple Responses / Incomplete Collection

**Symptoms**:

- Warning: "Expected N response events but got M"
- Only partial results returned

**Root Causes**:

- One handler times out while others succeed
- Handler count changed between registration and emission
- `strategy: 'first'` used with multiple handlers

**Debug Steps**:

```typescript
// Check listener count
console.log('Handlers registered:', emitter['#listeners'].get('my.action'));

// Use appropriate strategy
await emitter.emitAction('my.action', data, {
  strategy: 'collect', // Wait for ALL handlers (default)
  timeout: 5000,
});

await emitter.emitAction('my.action', data, {
  strategy: 'first', // Return after first response
});

await emitter.emitAction('my.action', data, {
  strategy: 'deep-merge', // Merge all responses
});
```

### 5. Error Events Not Handled

**Symptoms**:

- Silent failures
- Errors not propagated
- Unhandled promise rejections

**Root Causes**:

- No `onError` listener registered
- Error thrown in handler but not caught
- `ctx.error()` not awaited

**Debug Steps**:

```typescript
// Always register error listener
emitter.onError((errorEvent) => {
  console.error('Event error:', {
    name: errorEvent.name,
    source: errorEvent.source,
    correlationId: errorEvent.correlationId,
    error: errorEvent.error,
  });
});

// Errors in action handlers are auto-caught and emitted
emitter.onAction('my.action', (payload, ctx) => {
  try {
    const result = processPayload(payload);
    ctx.reply(result);
  } catch (err) {
    ctx.error(err); // Explicitly emit error event
  }
});

// emitAction re-throws first error received
try {
  await emitter.emitAction('my.action', data);
} catch (err) {
  // Error from handler propagated here
}
```

## Test Case Analysis Checklist

When analyzing a failed test:

- [ ] Event/Action name spelled correctly in both emit and handler?
- [ ] Handler registered before event emission?
- [ ] Handler calls `ctx.reply()` or `ctx.error()` for actions?
- [ ] Timeout sufficient for async operations?
- [ ] Correct emitter instance used (not creating multiple separate instances)?
- [ ] Error listener registered to catch failures?
- [ ] Expected number of handlers matches actual registrations?
- [ ] Strategy (`first`/`collect`/`deep-merge`) appropriate for use case?
- [ ] Subject not prematurely completed?
- [ ] Correlation IDs correctly linked (automatic via ctx)?

## Output Format

When debugging an event issue, provide:

1. **Summary**: One-sentence description of the issue
2. **Event Flow Map**: Producer → Event/Action → Handler(s) → Response
3. **Timing Analysis**: Emission timestamps, response times, timeout values
4. **Root Cause**: Specific line/code causing the issue
5. **Fix**: Concrete code change to resolve the issue
