import {
  type CachedError,
  oclif,
  prompts,
  ThymianBaseCommand,
  wrap,
} from '@thymian/common-cli';
import open from 'open';

import { createEmailDraft } from '../create-email-issue-for-error.js';
import { createGithubIssueDraft } from '../create-github-issue-url-for-error.js';

const NOT_INTERACTIVE =
  'thymian feedback needs an interactive terminal, so you can review what it would send. Run it again from a terminal.';

/** What the review shows, and the URL that sends exactly that. */
type Draft = {
  kind: 'issue draft' | 'email draft';
  headingLabel: 'Title' | 'Subject';
  heading: string;
  body: string;
  url: string;
};

export class Feedback extends ThymianBaseCommand<typeof Feedback> {
  protected static CONTACT = 'c3VwcG9ydEB0aHltaWFuLmRldg==';

  static override description =
    'Share CLI feedback or report the most recent command error. Needs an interactive terminal, so you can review what would be sent before anything opens.';

  override shouldSuppressFeedback(): boolean {
    return true;
  }

  /**
   * Skip `ThymianBaseCommand.catch()`, which writes an error record: whatever
   * fails inside `feedback` — the refusal, Ctrl+C, `open()` — must never
   * overwrite the record the user is about to send. oclif's own handling
   * still runs; its `catch` is protected, hence the cast.
   */
  protected override async catch(
    err: oclif.Interfaces.CommandError,
  ): Promise<void> {
    const oclifCatch = (
      oclif.Command.prototype as unknown as {
        catch(err: oclif.Interfaces.CommandError): Promise<void>;
      }
    ).catch;

    // Ctrl+C at a prompt: a normal interrupt, not an error.
    if (err.name === 'ExitPromptError') {
      return oclifCatch.call(this, new oclif.Errors.ExitError(130));
    }

    return oclifCatch.call(this, err);
  }

  override async run(): Promise<void> {
    if (!(process.stdin.isTTY && process.stdout.isTTY)) {
      this.logToStderr(NOT_INTERACTIVE);
      this.exit(2);
    }

    const lastError = await this.errorCache?.read();

    this.log(wrap('✨ Thank you for your feedback! ✨'));
    this.log();

    if (lastError) {
      this.log(
        wrap(
          `${oclif.ux.colorize('yellow', '⚠')} It looks like you encountered an error while running the ${oclif.ux.colorize('cyan', lastError.commandName)} command recently.`,
        ),
      );
      this.log();

      const reportError = await prompts.confirm({
        message: 'Do you want to report this error?',
      });

      if (reportError) {
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

    if (choice === 'none') {
      return;
    }

    const url = await this.review(choice, error);
    if (!url) {
      return;
    }

    await open(url);
    // Only once the browser or mail client was opened: declining at any step
    // before keeps the record, so it can still be reported later.
    await this.errorCache?.reset();
  }

  /**
   * Show the exact draft the channel would open, until the user sends it or
   * cancels. Leaving the stack out shows the reduced draft again first, so
   * what is confirmed is what is sent.
   *
   * @returns the URL to open, or `undefined` when the user cancelled
   */
  private async review(
    channel: 'github' | 'email',
    error: CachedError,
  ): Promise<string | undefined> {
    let withoutStack = false;

    for (;;) {
      const draft = this.draftFor(channel, error, withoutStack);

      this.log(`This ${draft.kind} is what would be sent:`);
      this.log();
      this.log(`${draft.headingLabel}: ${draft.heading}`);
      this.log();
      this.log(draft.body);
      this.log();

      const action = await prompts.select({
        message: `Send this ${draft.kind}?`,
        choices: [
          { name: 'Send', value: 'send' },
          ...(withoutStack
            ? []
            : [
                {
                  name: 'Leave the stack trace out',
                  description: 'Show the draft again without the stack trace.',
                  value: 'without-stack',
                },
              ]),
          { name: 'Cancel', description: 'Open nothing.', value: 'cancel' },
        ],
      });
      this.log();

      if (action === 'send') {
        return draft.url;
      }
      if (action === 'cancel') {
        return undefined;
      }
      withoutStack = true;
    }
  }

  private draftFor(
    channel: 'github' | 'email',
    error: CachedError,
    withoutStack: boolean,
  ): Draft {
    if (channel === 'github') {
      const { title, body, url } = createGithubIssueDraft(error, {
        withoutStack,
      });
      return {
        kind: 'issue draft',
        headingLabel: 'Title',
        heading: title,
        body,
        url,
      };
    }

    const { subject, body, url } = createEmailDraft(
      Buffer.from(Feedback.CONTACT, 'base64').toString('utf-8'),
      error,
      { withoutStack },
    );
    return {
      kind: 'email draft',
      headingLabel: 'Subject',
      heading: subject,
      body,
      url,
    };
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
