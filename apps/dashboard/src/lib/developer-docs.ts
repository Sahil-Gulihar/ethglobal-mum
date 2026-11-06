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
import { SKIP, visit } from "unist-util-visit";
import { codeHighlighter, codeThemes } from "./code-highlighting";

export const docGroups = [
  { label: "Get started", pages: [["", "Overview"], ["introduction", "Introduction"], ["quickstart", "Store integration quickstart"]] },
  { label: "Accept payments", pages: [["payment-links", "Payment links"], ["checkout-sessions", "Checkout sessions"], ["hosted-checkout", "Hosted checkout"], ["checkout-widget", "Checkout widget"], ["payments", "Payments"], ["refunds", "Refunds"], ["webhooks", "Webhooks"]] },
  { label: "Agents", pages: [["agents", "Agents and MCP"]] },
  { label: "Reference", pages: [["api-reference", "API reference"], ["errors", "Errors"], ["smart-contract", "Smart contract"]] },
  { label: "Operate", pages: [["dashboard", "Dashboard"], ["testing", "Test your integration"]] },
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
  const highlighter = await codeHighlighter;
  const languages = new Set(highlighter.getLoadedLanguages());
  const html = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeSlug)
    .use(() => (tree: Root) => {
      visit(tree, "element", (node, index, parent) => {
        if (node.tagName === "pre" && parent && index !== undefined) {
          const code = node.children[0];
          if (code?.type === "element" && code.tagName === "code") {
            const classes = code.properties.className;
            const lang = Array.isArray(classes)
              ? classes.find((name) => typeof name === "string" && name.startsWith("language-"))
              : undefined;
            const language = typeof lang === "string" ? lang.slice("language-".length) : "";
            if (languages.has(language)) {
              const highlighted = highlighter.codeToHast(toString(code).replace(/\n$/, ""), {
                ...codeThemes,
                lang: language,
              });
              parent.children.splice(index, 1, ...highlighted.children);
              return SKIP;
            }
          }
        }

        const productImagePrefix = "../../apps/dashboard/public/product/";
        if (node.tagName === "img" && typeof node.properties.src === "string"
          && node.properties.src.startsWith(productImagePrefix)) {
          node.properties.src = node.properties.src.replace(productImagePrefix, "/product/");
        }

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
