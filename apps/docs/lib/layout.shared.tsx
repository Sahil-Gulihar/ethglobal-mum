import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { dashboardUrl, gitConfig } from './shared';

function LogoMark() {
  return (
    <svg viewBox="0 0 1280 1280" aria-hidden className="size-6 shrink-0">
      <rect width="1280" height="1280" rx="230" fill="var(--color-fd-foreground)" />
      <path fill="var(--color-fd-background)" d="M123 430H244L317 649 410 430H488L571 649 661 430H779L887 590 1002 430H1128V824H1007V622L883 796 731 574 633 824H521L444 634 365 824H261Z" />
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
            White Money
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
