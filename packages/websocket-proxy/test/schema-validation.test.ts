import { describe, expect, it } from 'vitest';

import { isClientToServerMessage } from '../src/message-schemas';

describe('Message validation', () => {
  it('should validate register message', () => {
    const msg = { type: 'register', name: 'client-a', onActions: ['core.run'] };
    expect(isClientToServerMessage(msg)).toBe(true);
  });

  it('should validate ready message', () => {
    const msg = { type: 'ready' };
    expect(isClientToServerMessage(msg)).toBe(true);
  });

  it('should validate emit message', () => {
    const msg = { type: 'emit', name: 'core.report', payload: { a: 1 } };
    expect(isClientToServerMessage(msg)).toBe(true);
  });

  it('should validate emitAction message', () => {
    const msg = {
      type: 'emitAction',
      id: 'abc',
      name: 'core.run',
      payload: { x: 1 },
      options: { strategy: 'first', timeout: 1000 },
    };
    expect(isClientToServerMessage(msg)).toBe(true);
  });

  it('should validate actionReply message', () => {
    const reply = {
      type: 'actionReply',
      correlationId: 'c1',
      name: 'core.run',
      payload: { ok: true },
    };
    const error = {
      type: 'actionError',
      correlationId: 'c2',
      name: 'core.run',
      error: { message: 'fail' },
    };
    expect(isClientToServerMessage(reply)).toBe(true);
    expect(isClientToServerMessage(error)).toBe(true);
  });

  it('should fail for valid message type but invalid message', () => {
    const msg1 = { type: 'register' };
    const msg2 = { type: 'emit' };
    const msg3 = { type: 'emitAction', id: 'x' };
    expect(isClientToServerMessage(msg1)).toBe(false);
    expect(isClientToServerMessage(msg2)).toBe(false);
    expect(isClientToServerMessage(msg3)).toBe(false);
  });

  it('should fail for invalid message type', () => {
    const msg = { type: 'registerr' };
    expect(isClientToServerMessage(msg)).toBe(false);
  });
});
