(() => {
  const ua = navigator.userAgent || "";
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  if (/Windows/i.test(ua) || /^Win/i.test(platform)) {
    document.documentElement.dataset.platform = "windows";
  }
})();
