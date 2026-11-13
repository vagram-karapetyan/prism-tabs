(function bootPrismTheme() {
  try {
    var root = document.documentElement;
    var cachedTheme = localStorage.getItem('prism_theme_hint_v2') || 'system';
    var prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    var resolved = cachedTheme;
    if (cachedTheme === 'system') {
      resolved = prefersDark ? 'prism-deep' : 'pure-light';
    }

    var backgrounds = {
      'prism-deep': '#0b0e17',
      'midnight-nebula': '#0f0b1a',
      'emerald-forest': '#081410',
      'sunset-amber': '#16100b',
      'arctic-frost': '#08131a',
      'pure-light': '#f7f8fb',
    };

    var isLight = resolved === 'pure-light';
    root.dataset.theme = resolved;
    root.dataset.themeMode = cachedTheme;
    root.style.colorScheme = isLight ? 'light' : 'dark';
    root.style.backgroundColor = backgrounds[resolved] || '#0b0e17';
  } catch (_err) {
    // Ignore storage access errors during pre-paint boot
  }
})();
