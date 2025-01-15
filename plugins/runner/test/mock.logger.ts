import type { Logger } from '@thymian/core';

export class MockLogger implements Logger {
  name: string;

  constructor() {
    this.name = '';
  }

  debug = () => undefined;
  info = () => undefined;
  error = () => undefined;
  out = () => undefined;
  child(): Logger {
    return this;
  }
}
