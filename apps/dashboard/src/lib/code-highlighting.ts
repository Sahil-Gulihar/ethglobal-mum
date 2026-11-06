import "server-only";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

export const codeHighlighter = createHighlighterCore({
  engine: createOnigurumaEngine(import("shiki/wasm")),
  themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
  langs: [
    import("shiki/langs/bash.mjs"),
    import("shiki/langs/http.mjs"),
    import("shiki/langs/javascript.mjs"),
    import("shiki/langs/json.mjs"),
    import("shiki/langs/solidity.mjs"),
    import("shiki/langs/typescript.mjs"),
    import("shiki/langs/tsx.mjs"),
  ],
});

export const codeThemes = {
  themes: { light: "github-light", dark: "github-dark" },
  defaultColor: false,
} as const;
