import {
  type CachedError,
  oclif,
  prompts,
  ThymianBaseCommand,
} from '@thymian/common-cli';
import open from 'open';

import { createEmailReport } from '../create-email-issue-for-error.js';
import { createGithubIssueUrlForError } from '../create-github-issue-url-for-error.js';

export class Feedback extends ThymianBaseCommand<typeof Feedback> {
  protected static CONTACT = 'c3VwcG9ydEB0aHltaWFuLmRldg==';

  override shouldSuppressFeedback(): boolean {
    return true;
  }

  override async run(): Promise<void> {
    const lastError = await this.errorCache.read();

    this.log('✨ Thank you for your feedback! ✨');
    this.log();

    if (lastError) {
      this.log(
        `${oclif.ux.colorize('yellow', '⚠')} It looks like you encountered an error while running the ${oclif.ux.colorize('cyan', lastError.commandName)} command recently.`,
      );
      this.log();

      const reportError = await prompts.confirm({
        message: 'Do you want to report this error?',
      });

      if (reportError) {
        await this.errorCache.reset();

        await this.reportError(lastError);
      } else {
        await this.provideFeedback();
      }
    } else {
      await this.provideFeedback();
    }
  }

  private async reportError(error: CachedError): Promise<void> {
    const choices = [
      {
        name: 'Via GitHub',
        description: 'Report the error on GitHub via a new issue.',
        value: 'github',
      },
      {
        name: 'Via Email',
        description: 'Contact the Thymian Core team via Email.',
        value: 'email',
      },
      {
        name: 'Not at all ',
        description: "I don't want to report this error.",
        value: 'none',
      },
    ] as const;

    const choice = await prompts.select({
      message: 'How do you want to report this error?',
      choices,
    });
    this.log();

    if (choice === 'github') {
      await open(createGithubIssueUrlForError(error));
    } else if (choice === 'email') {
      await open(
        createEmailReport(
          Buffer.from(Feedback.CONTACT, 'base64').toString('utf-8'),
          error,
        ),
      );
    }
  }

  private async provideFeedback(): Promise<void> {
    const choices = [
      {
        name: 'Via GitHub',
        description: 'Open a GitHub issue to provide feedback.',
        value: 'github',
      },
      {
        name: 'Via Email',
        description: 'Contact the Thymian Core team via Email.',
        value: 'email',
      },
      {
        name: 'Not at all ',
        description: "I don't want to give feedback.",
        value: 'none',
      },
    ] as const;

    const choice = await prompts.select({
      message: 'How would you like to provide feedback?',
      choices,
    });

    if (choice === 'github') {
      await open('https://github.com/thymianofficial/thymian/issues/new');
    } else if (choice === 'email') {
      const recipient = Buffer.from(Feedback.CONTACT, 'base64').toString(
        'utf-8',
      );
      const subject = 'Thymian CLI Feedback';
      const body = `Hi Support Team,\n\nI'd like to provide some feedback regarding the CLI.\n\n[Please enter your message here]\n\nBest regards,\n[Your Name]`;
      await open(
        `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      );
    }
  }
}
