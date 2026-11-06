import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Whitechain Commerce';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

/** The merchant dashboard (sign up, API keys, payments). */
export const dashboardUrl = 'https://100lana.com';

export const gitConfig = {
  user: 'Sahil-Gulihar',
  repo: 'ethglobal-mum',
  branch: 'main',
  /** Where the Markdown sources live in the repo. */
  contentDir: 'docs/developers',
};

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];

  return { segments, url: getContentUrl(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
