import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { dashboardUrl, gitConfig } from './shared';

function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="size-6 shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--color-fd-foreground)" />
      <path
        d="M7.5 10.5 11.2 22l4.8-8.6 4.8 8.6 3.7-11.5"
        fill="none"
        stroke="var(--color-fd-background)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium tracking-[-0.02em]">
          <LogoMark />
          <span>
            Whitechain <span className="text-fd-muted-foreground">Commerce</span>
          </span>
        </span>
      ),
      url: '/docs',
    },
    links: [
      { text: 'Dashboard', url: dashboardUrl, external: true },
      { text: 'API reference', url: '/docs/api-reference' },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
