import type { CachedError } from '@thymian/cli-common';

export function createGithubIssueUrlForError(error: CachedError): string {
  const baseUrl = 'https://github.com/thymianofficial/thymian/issues/new';

  const title = `${error.name} while running in command \`${error.commandName}\``;

  const pluginTable =
    error?.pluginVersions
      .map((p) => `| ${p.name} | ${p.version} |`)
      .join('\n') || '| none | - |';

  const body = `
### 📝 Description
### 💻 Environment
- **CLI Version:** \`${error.version.cliVersion || 'N/A'}\`
- **Node Version:** \`${error.version.nodeVersion || 'N/A'}\`
- **OS:** \`${error?.version.osVersion || 'N/A'}\` (${error.version.architecture})
- **Command:** \`${error?.commandName} || ''}\`
- **Timestamp:** ${error ? new Date(error.timestamp).toLocaleString() : 'N/A'}

<details>
<summary><b>🔌 Installed Plugins</b></summary>

| Plugin | Version |
| :--- | :--- |
${pluginTable}
</details>

### 🔍 Error Details
${
  error.stack
    ? `
<details>
<summary><b>Click to expand Stacktrace</b></summary>

\`\`\`text
${error.stack.replaceAll(process.env.HOME || '', '~')}
\`\`\`
</details>
`
    : '_No stacktrace available._'
}

---
*Reported via \`thymian feedback\`*`.trim();

  const url = new URL(baseUrl);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  url.searchParams.set('labels', 'bug');

  return url.toString();
}
