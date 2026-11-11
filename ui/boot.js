(() => {
  const ua = navigator.userAgent || "";
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  if (/Windows/i.test(ua) || /^Win/i.test(platform)) {
    document.documentElement.dataset.platform = "windows";
  }

  const root = document.documentElement;
  const stored = window.localStorage.getItem("dual-dns-theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
  root.dataset.theme = theme;
  root.dataset.themeSource = stored === "light" || stored === "dark" ? "manual" : "system";
  const colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme) colorScheme.content = theme === "dark" ? "dark" : "light";
})();
