import type { CachedError } from '@thymian/common-cli';

import type { DraftOptions } from './create-github-issue-url-for-error.js';
import { shortenHomeDir } from './shorten-home-dir.js';

/** A prefilled email: what the user reviews and the mailto that opens it. */
export type EmailDraft = {
  subject: string;
  body: string;
  url: string;
};

export function createEmailDraft(
  recipient: string,
  errorData: CachedError,
  { withoutStack = false }: DraftOptions = {},
): EmailDraft {
  const subject = `CLI error in ${errorData.commandName}`;

  const stack = withoutStack
    ? '[Stack trace left out]'
    : errorData.stack
      ? shortenHomeDir(errorData.stack)
      : 'No stacktrace available';

  const body = `
Hi Support Team,

I'd like to provide some feedback regarding the CLI.
This email draft was prepared by thymian feedback for an error I ran into.

Command: ${errorData.commandName}
Timestamp: ${new Date(errorData.timestamp).toLocaleString()}

ENVIRONMENT:
- CLI: ${errorData.version.cliVersion}
- Node: ${errorData.version.nodeVersion}
- OS: ${errorData.version.osVersion} (${errorData.version.architecture})

PLUGINS:
${errorData.pluginVersions.map((p) => `  - ${p.name}: ${p.version}`).join('\n')}

STACKTRACE:
${stack}

Best regards,
[Your Name]
`.trim();

  return {
    subject,
    body,
    url: `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}
