import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';
import { blogSchema } from 'starlight-blog/schema';

const SOCIAL_CATEGORIES = [
  'thymian-general',
  'http-api-topics',
  'http-api-tooling',
  'real-world-use-cases',
  'educational',
  'thymian-hints',
] as const;

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: (context) => blogSchema(context),
    }),
  }),

  social: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/social' }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      category: z.enum(SOCIAL_CATEGORIES),
      publishStatus: z.enum(['draft', 'ready', 'published']).default('draft'),
      docLinks: z
        .array(
          z.object({
            label: z.string(),
            url: z.string().url(),
          }),
        )
        .default([]),
    }),
  }),
};
