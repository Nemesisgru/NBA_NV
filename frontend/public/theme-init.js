// Applies the saved light / dark theme before the app loads (avoids a flash of the wrong theme).
// Kept as a separate file so the Content-Security-Policy can forbid inline scripts.
(function () {
  try {
    var saved = localStorage.getItem('krgi_theme');
    var theme = (saved === 'light' || saved === 'dark') ? saved
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) { /* storage blocked: keep the default theme */ }
})();
