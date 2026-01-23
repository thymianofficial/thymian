# Thymian

Add resilience and HTTP conformance to your API development workflow. Thymian is a lightweight, language-agnostic library that helps you build robust APIs.

## @thymian/core-testing

`@thymian/core-testing` provides reusable testing utilities that make it easy to write tests for Thymian plugins and components. It includes:

- **Factories** for creating test data with sensible defaults
- **Mocks** for all major Thymian interfaces
- **Type-safe** utilities that match the `@thymian/core` types exactly

## Installation

```bash
npm install --save-dev @thymian/core-testing
```

### Quick Start

```typescript
import { createHttpRequest, createHttpResponse, createMockLogger, createMockEmitter, createMockPlugin } from '@thymian/core-testing';

// Create test data with sensible defaults
const request = createGetRequest({ path: '/users' });
const response = createOkResponse();

// Create test doubles
const logger = createMockLogger();
const emitter = createMockEmitter();

// Test your plugin
await myPlugin(emitter, logger, { cwd: '/test' });

// Assert on calls
expect(logger.info).toHaveBeenCalled();
expect(emitter.emit).toHaveBeenCalledWith('core.register', expect.any(Object));
```

### API Reference

#### Factories

##### Schema Factories

Create ThymianSchema objects with sensible defaults:

```typescript
import { createThymianSchema, createStringSchema, createNumberSchema, createIntegerSchema, createBooleanSchema, createObjectSchema, createArraySchema } from '@thymian/core-testing';

// Basic schemas
const stringSchema = createStringSchema({ minLength: 5, maxLength: 50 });
const numberSchema = createNumberSchema({ minimum: 0, maximum: 100 });
const integerSchema = createIntegerSchema();
const booleanSchema = createBooleanSchema();

// Complex schemas
const objectSchema = createObjectSchema({
  name: createStringSchema(),
  age: createIntegerSchema(),
});

const arraySchema = createArraySchema(createStringSchema());
```

##### Parameter Factories

Create Parameter objects:

```typescript
import { createParameter, createRequiredParameter, createOptionalParameter } from '@thymian/core-testing';

const param = createParameter({
  description: 'User ID',
  schema: createIntegerSchema(),
});

const requiredParam = createRequiredParameter({
  schema: createStringSchema(),
});
```

##### HTTP Request Factories

Create ThymianHttpRequest objects:

```typescript
import { createHttpRequest, createGetRequest, createPostRequest, createPutRequest, createPatchRequest, createDeleteRequest } from '@thymian/core-testing';

const getRequest = createGetRequest({
  path: '/api/users',
  queryParameters: {
    page: createParameter({ schema: createIntegerSchema() }),
  },
});

const postRequest = createPostRequest({
  path: '/api/users',
  body: createObjectSchema({
    name: createStringSchema(),
    email: createStringSchema(),
  }),
});
```

##### HTTP Response Factories

Create ThymianHttpResponse objects:

```typescript
import { createHttpResponse, createOkResponse, createCreatedResponse, createNoContentResponse, createBadRequestResponse, createUnauthorizedResponse, createForbiddenResponse, createNotFoundResponse, createInternalServerErrorResponse } from '@thymian/core-testing';

const okResponse = createOkResponse({
  schema: createObjectSchema({
    id: createIntegerSchema(),
    name: createStringSchema(),
  }),
});

const errorResponse = createNotFoundResponse({
  description: 'User not found',
});
```

##### ThymianFormat Factories

Create ThymianFormat instances:

```typescript
import { createThymianFormat, createThymianFormatWithTransaction, createThymianFormatWithTransactions } from '@thymian/core-testing';

// Empty format
const format = createThymianFormat();

// Format with one transaction
const formatWithOne = createThymianFormatWithTransaction(createGetRequest({ path: '/users' }), createOkResponse());

// Format with multiple transactions
const formatWithMany = createThymianFormatWithTransactions([
  [createGetRequest({ path: '/users' }), createOkResponse()],
  [createPostRequest({ path: '/users' }), createCreatedResponse()],
]);

// Format with 10 transactions
const formatWithSpecificNumber = createThymianFormatWithTransactions(10);
```

#### Mocks

##### Logger Mock

Create mock Logger instances:

```typescript
import { createMockLogger, createVerboseMockLogger, createSilentMockLogger } from '@thymian/core-testing';

// Standard mock (with vi.fn() spies)
const logger = createMockLogger({ namespace: 'test-plugin' });
logger.info('Starting plugin');
expect(logger.info).toHaveBeenCalledWith('Starting plugin');

// Verbose logger
const verboseLogger = createVerboseMockLogger();
expect(verboseLogger.verbose).toBe(true);

// Silent logger (no spies, just no-ops)
const silentLogger = createSilentMockLogger();
```

##### Emitter Mock

Create mock ThymianEmitter instances:

```typescript
import { createMockEmitter, createEmitterWithHandlers, createEmitterWithActionHandlers, captureEmittedEvents } from '@thymian/core-testing';

// Standard mock with spies
const emitter = createMockEmitter();
await emitter.emit('core.register', { plugin: myPlugin });
expect(emitter.emit).toHaveBeenCalledWith('core.register', expect.any(Object));

// Emitter with pre-configured handlers
const emitterWithHandlers = createEmitterWithHandlers({
  'core.error': vi.fn(),
  'core.register': vi.fn(),
});

// Capture all emitted events
const events = captureEmittedEvents(emitter);
await emitter.emit('core.register', { plugin: myPlugin });
expect(events).toHaveLength(1);
expect(events[0][0]).toBe('core.register');
```

##### Plugin Mock

Create mock ThymianPlugin instances:

```typescript
import { createMockPlugin, createSpyPluginFn, createPluginThatEmits, createPluginWithMetadata } from '@thymian/core-testing';

// Basic mock plugin
const plugin = createMockPlugin({
  name: 'test-plugin',
  version: '1.0.0',
});

// Plugin with spy function
const pluginFn = createSpyPluginFn(async (emitter, logger, options) => {
  logger.info('Plugin started');
});
const pluginWithSpy = createMockPlugin({ plugin: pluginFn });

// Plugin that emits events
const emittingPlugin = createPluginThatEmits('core.register', {
  plugin: myPlugin,
});

// Plugin with metadata
const pluginWithMeta = createPluginWithMetadata({
  name: 'my-plugin',
  version: '1.0.0',
  events: {
    emits: ['core.register'],
    listensOn: ['core.ready'],
  },
});
```

### Examples

#### Testing a Plugin

```typescript
import { describe, it, expect } from 'vitest';
import { createMockEmitter, createMockLogger } from '@thymian/core-testing';
import { myPlugin } from './my-plugin.js';

describe('myPlugin', () => {
  it('should register itself', async () => {
    const emitter = createMockEmitter();
    const logger = createMockLogger();

    await myPlugin(emitter, logger, { cwd: '/test' });

    expect(emitter.emit).toHaveBeenCalledWith(
      'core.register',
      expect.objectContaining({
        plugin: expect.any(Object),
      }),
    );
  });

  it('should log startup message', async () => {
    const emitter = createMockEmitter();
    const logger = createMockLogger();

    await myPlugin(emitter, logger, { cwd: '/test' });

    expect(logger.info).toHaveBeenCalledWith('Plugin started');
  });
});
```

#### Testing Format Transformations

```typescript
import { describe, it, expect } from 'vitest';
import { createThymianFormat, createGetRequest, createOkResponse } from '@thymian/core-testing';
import { transformFormat } from './transform.js';

describe('transformFormat', () => {
  it('should transform HTTP transactions', () => {
    const format = createThymianFormat();
    const request = createGetRequest({ path: '/users' });
    const response = createOkResponse();

    format.addHttpTransaction(request, response);

    const result = transformFormat(format);

    expect(result.getHttpTransactions()).toHaveLength(1);
  });
});
```

## Documentation

For comprehensive documentation, visit [Thymian Documentation](https://thymian.dev/).
