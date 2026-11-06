import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Root } from "hast";
import { toString } from "hast-util-to-string";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export const docGroups = [
  { label: "Get started", pages: [["", "Overview"], ["introduction", "Introduction"], ["quickstart", "Quickstart"]] },
  { label: "Accept payments", pages: [["checkout-sessions", "Checkout sessions"], ["hosted-checkout", "Hosted checkout"], ["checkout-widget", "Checkout widget"], ["payments", "Payments"], ["refunds", "Refunds"], ["webhooks", "Webhooks"]] },
  { label: "Reference", pages: [["api-reference", "API reference"], ["errors", "Errors"], ["smart-contract", "Smart contract"]] },
  { label: "Operate", pages: [["dashboard", "Dashboard"], ["testing", "Testing"], ["self-hosting", "Self-hosting"]] },
] as const;

export const docPages = docGroups.flatMap(({ label, pages }) =>
  pages.map(([slug, title]) => ({ slug, title, group: label })),
);

export const docHref = (slug: string) => slug ? `/docs/${slug}` : "/docs";
const sourceDir = path.resolve(process.cwd(), "../../docs/developers");
const sourceUrl = "https://github.com/Sahil-Gulihar/ethglobal-mum/blob/main/";

function docLink(href: string) {
  if (href.startsWith("#") || /^https?:\/\//i.test(href)) return href;
  if (!href.startsWith("./") && !href.startsWith("../")) return undefined;

  const [file, fragment] = href.split("#", 2);
  const anchor = fragment ? `#${fragment}` : "";
  if (file === "./README.md" || file === "./index.mdx") return docHref("") + anchor;
  if (file === "./llms.txt") return "/docs/llms.txt";
  const page = docPages.find(({ slug }) => file === `./${slug}.md`);
  if (page) return docHref(page.slug) + anchor;
  return sourceUrl + path.posix.normalize(`docs/developers/${file}`) + anchor;
}

export async function renderDoc(slug: string) {
  const source = slug ? path.join(sourceDir, `${slug}.md`) : path.resolve("docs-overview.md");
  const raw = await readFile(source, "utf8");
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const description = frontmatter?.[1].match(/^description: "([^"]+)"\s*$/m)?.[1];
  const markdown = frontmatter ? raw.slice(frontmatter[0].length).trimStart() : raw;
  const [, title, body] = markdown.match(/^# ([^\n]+)\n+([\s\S]*)$/) ?? [];
  const headings: { id: string; title: string; level: number }[] = [];
  const html = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeSlug)
    .use(() => (tree: Root) => {
      visit(tree, "element", (node) => {
        if (node.tagName === "a" && typeof node.properties.href === "string") {
          node.properties.href = docLink(node.properties.href);
        }
        if (/^h[23]$/.test(node.tagName) && typeof node.properties.id === "string") {
          headings.push({ id: node.properties.id, title: toString(node), level: Number(node.tagName[1]) });
        }
      });
    })
    .use(rehypeStringify)
    .process(body ?? markdown);

  return { title, description, html: String(html), headings };
}

export async function readDocsIndex() {
  const index = await readFile(path.join(sourceDir, "llms.txt"), "utf8");
  return index.replace(/\]\((\.\/[^)]+)\)/g, (match, href: string) => {
    const url = docLink(href);
    return url ? `](${url})` : match;
  });
}
