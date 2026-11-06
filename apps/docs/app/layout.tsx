import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './global.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://whitechain-docs.vercel.app'),
  title: { default: 'White Money Docs', template: '%s · White Money Docs' },
  description: 'Accept USDT on Whitechain: checkout widget, hosted checkout, webhooks, refunds and the REST API.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
