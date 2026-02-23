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

    if (this.shouldPrintFeedback()) {
      this.wasRun = true;
      await this.onRun();
    }
  }

  async error(): Promise<void> {
    if (!this.wasRun) {
      await this.onRun();
    }
  }

  // print the feedback hint in 20% of the cases
  shouldPrintFeedback(): boolean {
    return Math.random() < 0.2;
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
