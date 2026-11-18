import type { CachedError } from '@thymian/common-cli';

import { type DraftOptions, shortenHomeDir } from './draft.js';

/** A prefilled GitHub issue: what the user reviews and the URL that opens it. */
export type IssueDraft = {
  title: string;
  body: string;
  url: string;
};

export function createGithubIssueDraft(
  error: CachedError,
  { withoutStack = false }: DraftOptions = {},
): IssueDraft {
  const baseUrl = 'https://github.com/thymianofficial/thymian/issues/new';

  const title = error.commandName
    ? `${error.name} while running in command \`${error.commandName}\``
    : error.name;
  const commandMarkdown = error.commandName ? ` \`${error.commandName}\`` : '';

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
- **Command:**${commandMarkdown}
- **Timestamp:** ${error ? new Date(error.timestamp).toLocaleString() : 'N/A'}

<details>
<summary><b>🔌 Installed Plugins</b></summary>

| Plugin | Version |
| :--- | :--- |
${pluginTable}
</details>

### 🔍 Error Details
${stackMarkdown(error.stack, withoutStack)}

---
*Reported via \`thymian feedback\`*`.trim();

  const url = new URL(baseUrl);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  url.searchParams.set('labels', 'bug');

  return { title, body, url: url.toString() };
}

function stackMarkdown(
  stack: string | undefined,
  withoutStack: boolean,
): string {
  if (withoutStack) {
    return '_Stack trace left out._';
  }

  return stack
    ? `
<details>
<summary><b>Click to expand Stacktrace</b></summary>

\`\`\`text
${shortenHomeDir(stack)}
\`\`\`
</details>
`
    : '_No stacktrace available._';
}
