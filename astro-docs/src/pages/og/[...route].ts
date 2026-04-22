import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

const docs = await getCollection('docs');

const pages = Object.fromEntries(
  docs.map((doc) => [
    doc.id,
    {
      title: doc.data.title,
      description: doc.data.description || '',
    },
  ]),
);

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
