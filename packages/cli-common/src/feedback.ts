import type { Command } from '@oclif/core';

import type { BaseCliRunCommand } from './base-cli-run-command.js';
import type { ThymianBaseCommand } from './thymian-base-command.js';

export class Feedback {
  private wasRun = false;

  constructor(
    initial: boolean,
    private readonly onRun: () => Promise<unknown>,
  ) {
    this.wasRun = initial;
  }

  async run(): Promise<void> {
    if (this.wasRun) {
      return;
    }

    if (Math.random() < 0.2) {
      this.wasRun = true;
      await this.onRun();
    }
  }

  async error(): Promise<void> {
    if (!this.wasRun) {
      await this.onRun();
    }
  }

  static forCommand(
    command:
      | ThymianBaseCommand<typeof Command>
      | BaseCliRunCommand<typeof Command>,
  ): Feedback {
    return new Feedback(
      command.jsonEnabled() || command.shouldSuppressFeedback(),
      () => command.config.runHook('thymian.feedback', {}),
    );
  }
}
