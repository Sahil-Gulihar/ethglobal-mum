"use client";

import { useSyncExternalStore } from "react";

export type SiteTheme = "light" | "dark";

/**
 * The page's resolved theme: the explicit class on <html> (set before paint
 * from wc-theme, or by ThemeToggle), else the OS preference. Live: follows the
 * toggle and OS changes, so a Stage can switch its own theme with the page.
 */
function read(): SiteTheme {
  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export function useSiteTheme(): SiteTheme {
  return useSyncExternalStore(subscribe, read, () => "light");
}
