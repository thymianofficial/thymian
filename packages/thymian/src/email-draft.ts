import type { CachedError } from '@thymian/common-cli';

import { type Draft, type DraftOptions, shortenHomeDir } from './draft.js';

export function createEmailDraft(
  recipient: string,
  errorData: CachedError,
  { withoutStack = false }: DraftOptions = {},
): Draft {
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
    heading: subject,
    body,
    url: `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}
