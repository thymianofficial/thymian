import type { CachedError } from '@thymian/common-cli';

export function createEmailReport(
  recipient: string,
  errorData: CachedError,
): string {
  const subject = `CLI Error Report: ${errorData.commandName}`;

  const body = `
Hi Support Team,

I'd like to provide some feedback regarding the CLI.

${
  errorData
    ? `--- ERROR REPORT ---
Command: ${errorData.commandName}
Timestamp: ${new Date(errorData.timestamp).toLocaleString()}

ENVIRONMENT:
- CLI: ${errorData.version.cliVersion}
- Node: ${errorData.version.nodeVersion}
- OS: ${errorData.version.osVersion} (${errorData.version.architecture})

PLUGINS:
${errorData.pluginVersions.map((p) => `  - ${p.name}: ${p.version}`).join('\n')}

STACKTRACE:
${errorData.stack?.replaceAll(process.env.HOME || '', '~') || 'No stacktrace available'}
--------------------`
    : 'Description of my feedback:\n\n[Please enter your message here]'
}

Best regards,
[Your Name]
`.trim();

  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
