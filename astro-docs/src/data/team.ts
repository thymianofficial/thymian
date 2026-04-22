/**
 * Single source of truth for all team member data.
 *
 * Used by:
 *  - `astro.config.mjs` (starlight-blog `authors` config)
 *  - `EnterpriseResearch.astro` (team section on enterprise page)
 */

export interface TeamMember {
  /** Display name. */
  name: string;
  /** Team role shown on the enterprise page (e.g. "Core Member", "Engineering"). */
  role: string;
  /** Short biography (enterprise page founder cards). */
  bio?: string;
  /** LinkedIn profile URL. */
  linkedin?: string;
  /** Avatar initials (enterprise page founder cards). */
  initials?: string;
  /** Blog author title (e.g. "Core Team"). Shown next to blog posts. */
  title?: string;
  /** Personal or profile URL used for blog author links. */
  url?: string;
  /** Path or URL to an author picture for blog posts. */
  picture?: string;
}

// ── Founders ────────────────────────────────────────────────────────────

export const founders: TeamMember[] = [
  {
    name: 'Matthias Keckl',
    role: 'Core Member',
    bio: 'Drives research initiatives and engineering excellence. Bridges academic rigor with practical consulting to shape Thymian\u2019s rule engine and validation approach.',
    linkedin: 'https://www.linkedin.com/in/matthias-keckl/',
    initials: 'MK',
    title: 'Core Team',
    picture: '/team/matthias-keckl.webp',
  },
  {
    name: 'Peter Müller',
    role: 'Core Member',
    bio: 'Leads community engagement and core engineering. Focuses on developer experience, open-source collaboration, and helping teams adopt API conformance practices.',
    linkedin: 'https://www.linkedin.com/in/muellerpeter/',
    initials: 'PM',
    title: 'Core Team',
    picture: '/team/peter-muller.webp',
  },
  {
    name: 'Markus Ende',
    role: 'Core Member',
    bio: 'Seasoned engineer and consultant specializing in API quality. Brings deep expertise in HTTP standards and hands-on experience guiding enterprise integrations.',
    linkedin: 'https://www.linkedin.com/in/markus-ende/',
    initials: 'ME',
    title: 'Core Team',
    picture: '/team/markus-ende.webp',
  },
  {
    name: 'Andreas Tennert',
    role: 'Core Member',
    bio: 'Architects the plugin system and tooling integrations. Ensures Thymian fits seamlessly into existing CI/CD pipelines and developer workflows.',
    linkedin: 'https://www.linkedin.com/in/andreas-tennert/',
    initials: 'AT',
    title: 'Core Team',
    picture: '/team/andreas-tennert.webp',
  },
];

// ── Contributors ────────────────────────────────────────────────────────

export const contributors: TeamMember[] = [
  { name: 'Dariant Siswadie', role: 'Engineering' },
  { name: 'Gerrit Letz', role: 'Engineering' },
  { name: 'Johannes Witt', role: 'Engineering' },
  { name: 'Saninn Salas Díaz', role: 'Engineering' },
  { name: 'Marco Salas Díaz', role: 'Engineering' },
  { name: 'Moses Tamarazyan', role: 'Tooling' },
  { name: 'Andrea Cossu', role: 'Communication' },
  { name: 'Angelica Cossu', role: 'Organization' },
];

// ── Derived: starlight-blog authors config ──────────────────────────────

function toCamelCase(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ''));
}

/**
 * Blog authors record keyed by camelCase name (valid JS identifier required by starlight-blog).
 * Pass directly to `starlightBlog({ authors: blogAuthors })`.
 *
 * Reference in blog post frontmatter: `authors: peterMuller`
 */
export const blogAuthors: Record<
  string,
  { name: string; title?: string; url?: string; picture?: string }
> = Object.fromEntries(
  [...founders, ...contributors].map((m) => [
    toCamelCase(m.name),
    {
      name: m.name,
      ...(m.title && { title: m.title }),
      ...(m.url && { url: m.url }),
      ...(m.picture && { picture: m.picture }),
    },
  ]),
);
