import type { CollectionEntry } from 'astro:content';

export type SocialPublishStatus =
  CollectionEntry<'social'>['data']['publishStatus'];

export const SOCIAL_STATUS_LABELS = {
  draft: 'Draft',
  ready: 'Ready',
  published: 'Published',
} satisfies Record<SocialPublishStatus, string>;

export const SOCIAL_STATUS_ORDER = Object.keys(
  SOCIAL_STATUS_LABELS,
) as SocialPublishStatus[];
