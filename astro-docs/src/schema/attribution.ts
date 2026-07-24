import { z } from 'astro:content';

/**
 * Whether Thymian was the host of an event or a guest on someone else's.
 * Reusable across Epic 8 (Events) and Epic 9 (Resources).
 */
export const HOST_GUEST = ['host', 'guest'] as const;

/**
 * Honest Host/Guest attribution.
 *
 * A Guest appearance names the external host + platform (URL optional — a guest
 * with no URL is valid and renders as text). A Host appearance must carry no
 * external-host data at all (AD-13: never phrase a Thymian-hosted event as if
 * someone else ran it).
 */
export const attributionSchema = z
  .object({
    hostGuest: z.enum(HOST_GUEST),
    externalHost: z.string().optional(),
    platform: z.string().optional(),
    externalUrl: z.string().url().optional(),
  })
  .refine(
    (a) =>
      a.hostGuest !== 'guest' ||
      (a.externalHost !== undefined &&
        a.externalHost.trim().length > 0 &&
        a.platform !== undefined &&
        a.platform.trim().length > 0),
    {
      message:
        'A guest attribution must set both a non-empty `externalHost` and `platform` (the `externalUrl` stays optional).',
    },
  )
  .refine(
    (a) =>
      a.hostGuest !== 'host' ||
      (a.externalHost === undefined &&
        a.platform === undefined &&
        a.externalUrl === undefined),
    {
      message:
        'A host attribution must not set `externalHost`, `platform`, or `externalUrl` — Thymian is the host.',
    },
  );

/**
 * Parsed shape of {@link attributionSchema}. Declared explicitly rather than via
 * `z.infer` because `astro:content` re-exports zod's `z` as a value only (its
 * type namespace is not carried), so `z.infer<...>` does not resolve here.
 */
export type Attribution = {
  hostGuest: (typeof HOST_GUEST)[number];
  externalHost?: string;
  platform?: string;
  externalUrl?: string;
};
