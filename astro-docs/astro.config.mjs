// @ts-check
import { readdirSync } from 'node:fs';

import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import mailObfuscation from 'astro-mail-obfuscation';
import mermaid from 'astro-mermaid';
import starlightLlmsTxt from 'starlight-llms-txt';

const UMAMI_URL = process.env.UMAMI_URL;
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID;

function getPluginDirs() {
  return readdirSync('src/content/docs/plugins', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
}

// https://astro.build/config
export default defineConfig({
  site: 'https://thymian.dev',
  integrations: [
    mermaid({
      theme: 'forest', // sadly only works when the browser doesn't support dark/light mode
      autoTheme: true,
    }),
    starlight({
      title: 'Thymian',
      routeMiddleware: './src/route-data.ts',
      customCss: [
        // Path to your Tailwind base styles:
        './src/styles/global.css',
      ],
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      head: [
        ...(UMAMI_URL && UMAMI_WEBSITE_ID
          ? [
              {
                tag: /** @type {'script'} */ ('script'),
                attrs: {
                  async: true,
                  defer: true,
                  src: `https://${UMAMI_URL}/script.js`,
                  'data-website-id': UMAMI_WEBSITE_ID,
                },
              },
            ]
          : []),
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/thymianofficial/thymian',
        },
        {
          icon: 'discord',
          label: 'Discord',
          href: 'https://discord.gg/TRSwCxbz9f',
        },
        { icon: 'twitter', label: 'Twitter', href: 'https://x.com/thymiandev' },
        {
          icon: 'reddit',
          label: 'Reddit',
          href: 'https://www.reddit.com/r/ThymianOfficial/',
        },
      ],
      sidebar: [
        {
          label: 'Introduction',
          autogenerate: { directory: 'introduction' },
        },
        {
          label: 'Guides',
          items: [
            // Each item here is one entry in the navigation menu.
            { label: 'Example Guide', slug: 'guides/example' },
          ],
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
        {
          label: 'Plugins',
          items: getPluginDirs().map((dirName) => ({
            label: dirName,
            autogenerate: { directory: `plugins/${dirName}` },
          })),
        }
      ],
      components: {
        Header: './src/components/ThymianHeader.astro',
        Footer: './src/components/Footer.astro',
      },
      plugins: [
        starlightLlmsTxt({
          projectName: 'Thymian',
        }),
      ],
    }),
    mailObfuscation({
      fallbackText: 'Please activate JavaScript in the browser.',
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['zod'],
    },
  },
});
