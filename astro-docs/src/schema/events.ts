import type { CollectionEntry } from 'astro:content';
import { z } from 'astro:content';

import { attributionSchema } from './attribution';
import { eventDateSchema } from './event-date';
import { isTeamKey, TEAM_KEYS } from './team-keys';

/** Typed participation kinds an event can represent. */
export const PARTICIPATION_TYPES = [
  'talk',
  'livestream',
  'podcast',
  'booth',
  'paper',
  'panel',
] as const;

/** Whether Thymian is presenting at the event or merely attending. */
export const PARTICIPATION_MODES = ['presenting', 'attending'] as const;

export type ParticipationType = (typeof PARTICIPATION_TYPES)[number];
export type ParticipationMode = (typeof PARTICIPATION_MODES)[number];

export const eventsSchema = z
  .object({
    title: z.string(),
    participation: z.enum(PARTICIPATION_TYPES),
    mode: z.enum(PARTICIPATION_MODES),
    speakers: z
      .array(z.string())
      .default([])
      .superRefine((keys, ctx) => {
        const bad = keys.filter((k) => !isTeamKey(k));
        if (bad.length > 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['speakers'],
            message: `Unknown speaker key(s): ${bad.join(', ')}. Valid team keys: ${TEAM_KEYS.join(', ')}.`,
          });
        }
        const duplicates = [
          ...new Set(keys.filter((k, i) => keys.indexOf(k) !== i)),
        ];
        if (duplicates.length > 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['speakers'],
            message: `Duplicate speaker key(s): ${duplicates.join(', ')}.`,
          });
        }
      }),
    location: z.string().optional(),
    online: z.boolean().optional(),
    date: eventDateSchema,
    attribution: attributionSchema.optional(),
  })
  .refine(
    (e) => {
      const hasLocation =
        e.location !== undefined && e.location.trim().length > 0;
      const isOnline = e.online === true;
      // Place is physical XOR online — exactly one.
      return hasLocation !== isOnline;
    },
    {
      message:
        'An event must have exactly one place: set a physical `location` OR `online: true` — not both, not neither.',
    },
  );

export type EventData = CollectionEntry<'events'>['data'];
