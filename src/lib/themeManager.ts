export type UiTheme = "dark" | "light";

export const UI_THEME_STORAGE_KEY = "cp_settings_ui_theme";

export function getUiTheme(): UiTheme {
  try {
    const saved = localStorage.getItem(UI_THEME_STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyUiTheme(theme: UiTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("theme-light", theme === "light");
  root.classList.toggle("theme-dark", theme === "dark");
}

export function setUiTheme(theme: UiTheme): void {
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  } catch {}
  applyUiTheme(theme);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<UiTheme>("cp-theme-change", { detail: theme }));
  }
}
