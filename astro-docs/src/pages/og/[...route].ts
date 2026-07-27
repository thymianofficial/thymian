import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

import { eventOgPages } from '../../components/events/eventMeta';

const docs = await getCollection('docs');

const docPages = Object.fromEntries(
  docs.map((doc) => [
    doc.id,
    {
      title: doc.data.title,
      description: doc.data.description || '',
    },
  ]),
);

// Events are keyed by their page `starlightRoute.id` (`events`,
// `events/type/<type>`) because event cards render inline on a fixed page set —
// there are NO per-event detail routes, so we must NOT key by per-event-entry
// ids (AD-4). Events are intentionally NOT added to `llms.txt` in v1:
// `starlight-llms-txt` is hardwired to `getCollection('docs')` with no extension
// hook, so hand-rolling a parallel generator is out of scope (AD-5).
const pages = { ...docPages, ...eventOgPages() };

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (path, page) => ({
    title: page.title,
    description: page.description,
    bgImage: {
      path: `./src/assets/og-background.png`,
    },
    font: {
      title: {
        size: 50,
        weight: 'SemiBold',
        color: [255, 255, 255],
      },
      description: {
        size: 30,
        weight: 'Normal',
        color: [255, 255, 255],
      },
    },
    format: 'JPEG',
    quality: 100,
  }),
});
