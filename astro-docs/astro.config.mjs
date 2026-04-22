// @ts-check
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import mailObfuscation from 'astro-mail-obfuscation';
import mermaid from 'astro-mermaid';
import starlightBlog from 'starlight-blog';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';

import { blogAuthors } from './src/data/team';

const UMAMI_URL = process.env.UMAMI_URL;
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID;

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
        {
          icon: 'linkedin',
          label: 'LinkedIn',
          href: 'https://www.linkedin.com/company/thymiandev/',
        },
      ],
      sidebar: [
        {
          slug: 'introduction/what-is-thymian',
          attrs: { style: 'font-weight: normal;' },
        },
        {
          slug: 'introduction/getting-started',
          attrs: { style: 'font-weight: normal;' },
        },
        {
          label: 'Tutorials',
          collapsed: true,
          autogenerate: { directory: 'tutorials' },
        },
        {
          label: 'Guides',
          collapsed: true,
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'References',
          collapsed: true,
          autogenerate: { directory: 'references' },
        },
        {
          label: 'Concepts',
          collapsed: true,
          autogenerate: { directory: 'concepts' },
        },
      ],
      components: {
        Header: './src/components/ThymianHeader.astro',
        Footer: './src/components/Footer.astro',
        MobileMenuFooter: './src/components/ThymianMobileMenuFooter.astro',
      },
      plugins: [
        starlightBlog({
          title: 'Blog',
          prefix: 'blog',
          postCount: 10,
          recentPostCount: 5,
          authors: blogAuthors,
        }),
        starlightLlmsTxt({
          projectName: 'Thymian',
        }),
        starlightLinksValidator(),
      ],
    }),
    mailObfuscation({
      fallbackText: 'Please activate JavaScript in the browser.',
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
