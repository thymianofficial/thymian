import type { CollectionEntry } from 'astro:content';
import { reference, z } from 'astro:content';

import { attributionSchema } from './attribution';

/** Typed kinds of media a resource entry can represent. */
export const RESOURCE_TYPES = [
  'recorded talk',
  'webinar',
  'podcast episode',
  'paper',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

/**
 * The `resources` collection schema — externally-hosted media (talks, webinars,
 * podcast episodes, papers) that Thymian produced or took part in.
 *
 * Plain `z.object` (no `SchemaContext` factory): unlike `events`, there is no
 * `image()` field here. `attribution` is REQUIRED (vs `.optional()` on events)
 * because every resource is externally-hosted media with a real host/guest
 * nature (AD-13 credibility guarantee). `originEvent` uses
 * `reference('events')`, but under Astro 7.1.3 that check is WARN-ONLY — a
 * dangling id yields `getEntry → undefined` plus a console warning, NOT a build
 * error. The AD-6 build-time integrity guard therefore lives in
 * `src/lib/cross-links.ts`: `resolveOriginEvent` / `assertOriginEventsResolve`
 * THROW on a dangling reference so `astro build` fails loudly instead of
 * rendering a silent broken link.
 */
export const resourcesSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'A resource `title` must not be empty or whitespace-only.'),
  resourceType: z.enum(RESOURCE_TYPES),
  url: z.string().trim().url(),
  embeddable: z.boolean(),
  attribution: attributionSchema,
  originEvent: reference('events').optional(),
});

export type ResourceData = CollectionEntry<'resources'>['data'];
