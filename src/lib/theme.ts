export const themeStorageKey = "hamkhane-theme";
export type Theme = "light" | "dark";

// Resolve the device preference once, before paint, then keep a concrete choice.
// Older saved "system" values are migrated in the same way as a first visit.
export const themeInitScript = `(() => {
  let theme;
  try { theme = localStorage.getItem("${themeStorageKey}"); } catch {}
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    try { localStorage.setItem("${themeStorageKey}", theme); } catch {}
  }
  document.documentElement.dataset.theme = theme;
})();`;
