---
name: create-social-content
description: Create social media content for the Thymian project. Use this skill when asked to write, draft, or create social media posts, content for platforms like Reddit, X (Twitter), LinkedIn, or Discord, or when working with files under astro-docs/src/content/social/. Triggers include "create social post", "write social content", "draft tweet", "LinkedIn post", "Reddit post", "Discord message", "social media".
---

# Create Social Content Skill

This skill helps create social media content for the Thymian project. All social content lives in `astro-docs/src/content/social/` and is rendered using Astro components that provide platform-specific previews, character counters, image generation, and copy-to-clipboard functionality.

## File Locations

- **Social content**: `astro-docs/src/content/social/{category}/{slug}.mdx`
- **Components**: `astro-docs/src/components/social/`
- **Content config**: `astro-docs/src/content.config.ts`

## Categories

Content must belong to one of these categories (used as subdirectory names):

| Category               | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `thymian-general`      | General Thymian announcements and introductions |
| `thymian-hints`        | Quick tips and CLI usage patterns               |
| `http-api-topics`      | HTTP and API educational content                |
| `http-api-tooling`     | HTTP/API tooling landscape and comparisons      |
| `real-world-use-cases` | Real-world scenarios and case studies           |
| `educational`          | General educational content                     |

## Frontmatter Schema

Every `.mdx` file requires this frontmatter:

```yaml
---
title: 'Post Title'
description: 'Brief description of the post purpose'
category: thymian-hints # One of the categories above
publishStatus: draft # 'draft', 'ready', or 'published'
docLinks: # Optional array of related docs
  - label: 'Link Label'
    url: 'https://thymian.dev/...'
---
```

## Required Imports

Every social content file must import the components it uses:

```mdx
import PlatformSection from '../../../components/social/PlatformSection.astro';
import PostText from '../../../components/social/PostText.astro';
import SocialImage from '../../../components/social/SocialImage.astro';
```

## File Structure

A social content file follows this pattern:

```mdx
---
title: '...'
description: '...'
category: ...
publishStatus: draft
docLinks: [...]
---

import PlatformSection from '../../../components/social/PlatformSection.astro';
import PostText from '../../../components/social/PostText.astro';
import SocialImage from '../../../components/social/SocialImage.astro';

## Reddit

<PlatformSection platform="reddit">
  <PostText platform="reddit" label="Title">
Reddit post title here
  </PostText>

<PostText platform="reddit" label="Post body">
  Reddit post body here
</PostText>

  <SocialImage type="code-snippet" platform="reddit" lang="bash" codeLabel="Label" code={`command here`} />
</PlatformSection>

## X (Twitter)

<PlatformSection platform="x">
  <PostText platform="x">
Tweet text here
  </PostText>

  <SocialImage type="code-snippet" platform="x" lang="bash" codeLabel="Label" code={`command here`} />
</PlatformSection>

## LinkedIn

<PlatformSection platform="linkedin">
  <PostText platform="linkedin">
LinkedIn post text here
  </PostText>

  <SocialImage type="code-snippet" platform="linkedin" lang="bash" codeLabel="Label" code={`command here`} />
</PlatformSection>

## Discord

<PlatformSection platform="discord">
  <PostText platform="discord">
Discord message text here
  </PostText>

  <SocialImage type="code-snippet" platform="discord" lang="bash" codeLabel="Label" code={`command here`} />
</PlatformSection>
```

## Platform-Specific Guidelines

### Supported Platforms

| Platform  | Type Prop    | Character Limit | Notes                                                |
| --------- | ------------ | --------------- | ---------------------------------------------------- |
| Reddit    | `"reddit"`   | No hard limit   | Title + body are separate `PostText`s                |
| X/Twitter | `"x"`        | **280 chars**   | Most restrictive — be extremely concise              |
| LinkedIn  | `"linkedin"` | **3,000 chars** | Professional tone, supports markdown-like formatting |
| Discord   | `"discord"`  | **2,000 chars** | Supports full Markdown syntax                        |

### Reddit

- **Two `PostText` blocks**: one for the title (`label="Title"`), one for the body (`label="Post body"`)
- Title should be under 300 characters
- No hard character limit on the body, but keep it scannable
- Supports Markdown in the body: `**bold**`, `*italic*`, `~~strikethrough~~`, lists, code blocks, links
- Use conversational, community-friendly tone
- Ask an engaging question at the end to encourage discussion
- Include a link at the bottom

**Formatting support:**

- Headings: `#`, `##`, etc.
- Bold: `**text**`
- Italic: `*text*`
- Strikethrough: `~~text~~`
- Inline code: `` `code` ``
- Code blocks: ` ```language ... ``` `
- Bullet lists: `- item` or `* item`
- Numbered lists: `1. item`
- Block quotes: `> quote`
- Links: `[text](url)` (auto-linked bare URLs too)
- Tables: not reliably rendered on all Reddit clients

### X (Twitter)

- **Single `PostText` block** (no label prop needed, defaults to "Post text")
- **Hard limit: 280 characters** — the component shows a live counter and highlights red when over
- No Markdown support — plain text only
- URLs count as 23 characters regardless of actual length (t.co wrapping)
- Emojis count as 2 characters
- Newlines count as 1 character
- Use line breaks strategically to create visual structure
- End with a URL on its own line
- No hashtags unless genuinely relevant (they reduce engagement on X)

**Formatting support:**

- None — plain text only
- Line breaks for structure
- Emojis for visual cues (use sparingly)

### LinkedIn

- **Single `PostText` block**
- **Limit: 3,000 characters** — but first ~210 characters appear before the "see more" fold
- Front-load the hook in the first 2 lines — this is what people see before clicking "see more"
- Professional, authoritative tone
- Supports limited formatting in the actual platform (not full Markdown)
- Use emojis as bullet markers (✅, 🔗, etc.) for scanability
- End with hashtags on a separate line: `#API #HTTP #OpenSource #DevTools`
- Include 3–5 relevant hashtags

**Formatting support (on actual LinkedIn):**

- Bold: supported (copy-paste Unicode bold or use platform editor)
- Italic: supported (copy-paste Unicode italic or use platform editor)
- Bullet lists: use emoji bullets (✅, •, →) or just dash `-`
- Line breaks: supported and important for readability
- No headings, no code blocks, no inline code, no links in Markdown syntax
- Bare URLs are auto-linked
- Note: `**bold**` in the MDX content is for preview purposes — when copying to LinkedIn, you need to apply bold using LinkedIn's editor or Unicode characters

### Discord

- **Single `PostText` block** (can use `label="Message text"` for clarity)
- **Limit: 2,000 characters**
- Full Markdown support — Discord renders it natively
- Use code blocks with language hints for syntax highlighting
- Use `**bold**` for emphasis
- Keep it concise — Discord users skim quickly
- Link at the end

**Formatting support:**

- Bold: `**text**`
- Italic: `*text*`
- Underline: `__text__`
- Strikethrough: `~~text~~`
- Inline code: `` `code` ``
- Code blocks: ` ```language ... ``` `
- Block quotes: `> quote`, `>>> multi-line quote`
- Spoilers: `||text||`
- Headers: `# H1`, `## H2`, `### H3` (max 3 levels)
- Bullet lists: `- item` or `* item`
- Numbered lists: `1. item`
- Links: `[text](url)` or bare URLs (auto-embedded)
- Masked links: `[text](url "title")`
- No tables

## Component Reference

### `<PlatformSection platform="...">`

Wraps content for a specific platform. Displays the platform icon, label, and character limit hint.

**Props:**

| Prop       | Type                                         | Required | Description     |
| ---------- | -------------------------------------------- | -------- | --------------- |
| `platform` | `'reddit' \| 'x' \| 'linkedin' \| 'discord'` | Yes      | Target platform |

### `<PostText platform="..." label="...">`

Renders a text block with character counter (for platforms with limits) and a "Copy text" button.

**Props:**

| Prop       | Type                                         | Required | Default       | Description                |
| ---------- | -------------------------------------------- | -------- | ------------- | -------------------------- |
| `platform` | `'reddit' \| 'x' \| 'linkedin' \| 'discord'` | Yes      | —             | Platform for char counting |
| `label`    | `string`                                     | No       | `'Post text'` | Label shown above the text |

Content goes between the opening and closing tags. **Do not indent the content** — leading whitespace is preserved.

### `<SocialImage type="..." platform="..." ...>`

Generates a branded social image preview with download-as-PNG functionality.

**Props:**

| Prop             | Type                                             | Required | Default        | Description                             |
| ---------------- | ------------------------------------------------ | -------- | -------------- | --------------------------------------- |
| `type`           | `'code-snippet' \| 'side-by-side' \| 'headline'` | Yes      | —              | Image layout type                       |
| `platform`       | `'reddit' \| 'x' \| 'linkedin' \| 'discord'`     | No       | `'x'`          | Determines image dimensions             |
| `variant`        | `'landscape' \| 'square'`                        | No       | `'landscape'`  | Aspect ratio                            |
| `code`           | `string`                                         | No       | —              | Code for main (or left) panel           |
| `lang`           | `string`                                         | No       | `'typescript'` | Language for syntax highlighting        |
| `rightCode`      | `string`                                         | No       | —              | Code for the right panel (side-by-side) |
| `rightLang`      | `string`                                         | No       | `'http'`       | Language for right panel                |
| `codeLabel`      | `string`                                         | No       | —              | Label above main code panel             |
| `rightCodeLabel` | `string`                                         | No       | —              | Label above right code panel            |
| `headline`       | `string`                                         | No       | —              | Headline text (headline type only)      |
| `subheadline`    | `string`                                         | No       | —              | Sub-headline (headline type only)       |
| `promoted`       | `boolean`                                        | No       | `false`        | Center code, no line-break for shell    |

**Image dimensions by platform:**

| Platform | Landscape  | Square      |
| -------- | ---------- | ----------- |
| X        | 1200 × 628 | 1080 × 1080 |
| Reddit   | 1200 × 628 | 1080 × 1080 |
| LinkedIn | 1200 × 627 | 1080 × 1080 |
| Discord  | 1200 × 630 | 1080 × 1080 |

**Image type guidelines:**

- `code-snippet` — Best for single commands or short code examples. Use `promoted` for single-line commands to center them prominently on the image.
- `side-by-side` — Best for before/after comparisons or request/response pairs. Use `code`/`lang`/`codeLabel` for the left panel and `rightCode`/`rightLang`/`rightCodeLabel` for the right panel.
- `headline` — Best for announcements or conceptual posts without code. Use `headline` and optionally `subheadline`.

## Writing Guidelines

### Tone & Voice

- **Thymian brand voice**: Technical, helpful, direct — not salesy or hype-driven
- Focus on **what it does** and **why it matters**, not marketing superlatives
- Use concrete examples over abstract claims
- Link to thymian.dev documentation when relevant

### Content Strategy

- Each post covers **one clear idea** — don't cram multiple features
- Lead with the value, not the tool name
- Include a working CLI command when applicable
- Reference specific RFC numbers (e.g., RFC 9110) to establish authority
- Use the "write once, validate everywhere" messaging when describing lint/test/analyze

### Cross-Platform Adaptation

When creating the same message for multiple platforms:

1. **Start with Reddit or LinkedIn** — these allow the most detail
2. **Distill for X** — extract the single most compelling sentence + a command + a link
3. **Adapt for Discord** — short, Markdown-rich, code-block-friendly
4. Each platform version should feel native, NOT like a truncated copy of another

### Common Mistakes to Avoid

- ❌ Don't use `**bold**` on X — it renders as literal asterisks
- ❌ Don't put code blocks in LinkedIn posts — they don't render
- ❌ Don't forget to set `publishStatus` in frontmatter
- ❌ Don't indent `PostText` children — whitespace is preserved
- ❌ Don't exceed character limits — the counter will turn red but content should be fixed
- ❌ Don't include hashtags on X unless genuinely relevant
- ❌ Don't use `[link](url)` syntax on LinkedIn or X — use bare URLs

## Validation Checklist

When creating social content, verify:

- [ ] Frontmatter has all required fields (`title`, `description`, `category`, `publishStatus`)
- [ ] `category` is one of the six valid values
- [ ] `publishStatus` is set (use `draft` initially)
- [ ] All four platforms are included (Reddit, X, LinkedIn, Discord)
- [ ] Reddit has separate title and body `PostText` blocks
- [ ] X post is under 280 characters (accounting for URL = 23 chars)
- [ ] LinkedIn post is under 3,000 characters
- [ ] Discord message is under 2,000 characters
- [ ] Each platform has at least one `SocialImage`
- [ ] `SocialImage` `platform` prop matches its parent `PlatformSection`
- [ ] No Markdown formatting used on X (plain text only)
- [ ] No code blocks used on LinkedIn
- [ ] `PostText` content is not indented (whitespace is preserved)
- [ ] `docLinks` contain valid URLs to thymian.dev
- [ ] Content feels native to each platform, not copy-pasted between them
