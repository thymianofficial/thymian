/**
 * Single source of truth for all site navigation links.
 *
 * Used by:
 *  - `ThymianHeader.astro` (desktop pill row — filters to `pills+panel`)
 *  - `ThymianMobileMenuFooter.astro` (sub-800px panel — Story 13.2, consumes the full list)
 *
 * Socials are NOT part of this module — they stay in `astro.config.ts` `social[]`.
 */

export type NavPlacement = 'pills+panel' | 'panel-only';

export interface NavLink {
  /** Exact chrome copy: single word, sentence case. */
  label: string;
  /** Route path or `mailto:` link. */
  href: string;
  /** Where this link renders. */
  placement: NavPlacement;
  /** Marks the Enterprise call-to-action pill (pinned styling, always last). */
  isCta?: boolean;
}

export const NAV_LINKS: readonly NavLink[] = [
  {
    label: 'Docs',
    href: '/introduction/what-is-thymian/',
    placement: 'panel-only',
  },
  { label: 'Events', href: '/events/', placement: 'pills+panel' },
  { label: 'Resources', href: '/resources/', placement: 'pills+panel' },
  { label: 'Blog', href: '/blog/', placement: 'pills+panel' },
  {
    label: 'Contact',
    href: 'mailto:support@thymian.dev',
    placement: 'pills+panel',
  },
  {
    label: 'Enterprise',
    href: '/enterprise/',
    placement: 'pills+panel',
    isCta: true,
  },
];

function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/**
 * Resolves the `aria-current` value for a nav link given the current page path.
 * Exact route match → `'page'`; section/descendant match (on a segment boundary) → `'true'`;
 * `mailto:`/external/no match → `undefined`.
 */
export function resolveAriaCurrent(
  href: string,
  pathname: string,
): 'page' | 'true' | undefined {
  if (!href.startsWith('/')) {
    return undefined;
  }

  const normalizedHref = withTrailingSlash(href);
  const normalizedPathname = withTrailingSlash(pathname);

  if (normalizedHref === normalizedPathname) {
    return 'page';
  }
  if (normalizedPathname.startsWith(normalizedHref)) {
    return 'true';
  }
  return undefined;
}
