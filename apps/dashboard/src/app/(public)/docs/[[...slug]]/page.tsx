import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { docGroups, docHref, docPages, renderDoc } from "@/lib/developer-docs";

type Props = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return docPages.map(({ slug }) => ({ slug: slug ? [slug] : [] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const current = ((await params).slug ?? []).join("/");
  const page = docPages.find(({ slug }) => slug === current);
  return { title: page?.slug ? `${page.title} | Docs` : "Merchant docs" };
}

export default async function DocsPage({ params }: Props) {
  const slug = ((await params).slug ?? []).join("/");
  const index = docPages.findIndex((page) => page.slug === slug);
  const page = docPages[index];
  if (!page) notFound();

  const { title, description, html, headings } = await renderDoc(page.slug);
  const previous = docPages[index - 1];
  const next = docPages[index + 1];

  return (
    <div className="public-frame docs-grid">
      <aside className="docs-sidebar">
        <details className="docs-mobile-nav">
          <summary>Browse docs</summary>
          <DocsNavigation active={slug} />
        </details>
        <div className="docs-desktop-nav"><DocsNavigation active={slug} /></div>
      </aside>
      <main className="docs-main">
        {headings.length > 0 && (
          <details className="docs-compact-outline">
            <summary>On this page</summary>
            <OutlineLinks headings={headings} />
          </details>
        )}
        <article>
          <header className="docs-title">
            <p>{page.group}</p>
            <h1>{title ?? page.title}</h1>
            {!slug && (
              <div className="public-actions">
                <Link className="public-primary" href="/docs/quickstart">Integrate your store</Link>
                <Link className="public-secondary" href="/docs/payment-links">Use payment links</Link>
              </div>
            )}
          </header>
          <div className="docs-prose">
            {description && <p>{description}</p>}
            <div className="docs-prose" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </article>
        <nav className="docs-pagination" aria-label="Previous and next docs">
          {previous && <Link href={docHref(previous.slug)}><span>Previous</span>{previous.title}</Link>}
          {next && <Link href={docHref(next.slug)}><span>Next</span>{next.title}</Link>}
        </nav>
      </main>
      {headings.length > 0 && (
        <nav className="docs-outline" aria-label="On this page">
          <p>On this page</p>
          <OutlineLinks headings={headings} />
        </nav>
      )}
    </div>
  );
}

function OutlineLinks({ headings }: { headings: Awaited<ReturnType<typeof renderDoc>>["headings"] }) {
  return (
    <ul>
      {headings.map(({ id, title, level }) => (
        <li key={id} data-depth={level}><a href={`#${id}`}>{title}</a></li>
      ))}
    </ul>
  );
}

function DocsNavigation({ active }: { active: string }) {
  return (
    <nav className="docs-navigation" aria-label="Documentation">
      {docGroups.map(({ label, pages }) => (
        <div key={label}>
          <p>{label}</p>
          <ul>
            {pages.map(([slug, title]) => (
              <li key={slug}>
                <Link href={docHref(slug)} aria-current={slug === active ? "page" : undefined}>{title}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <a href="/docs/llms.txt">llms.txt</a>
    </nav>
  );
}
