import { PrismThemeId } from '../engine/types';

export interface ThemeDefinition {
  id: PrismThemeId;
  name: string;
  tagline: string;
  mode: 'dark' | 'light';
  emoji: string;
  colors: {
    bg: string;
    surface: string;
    card: string;
    border: string;
    accent: string;
    previewDots: [string, string, string];
  };
}

export const PRISM_THEMES: Record<PrismThemeId, ThemeDefinition> = {
  'prism-deep': {
    id: 'prism-deep',
    name: 'Prism Deep',
    tagline: 'Cosmic Noir & Rainbow Beam',
    mode: 'dark',
    emoji: '🌈',
    colors: {
      bg: '#090A0F',
      surface: '#12151E',
      card: '#181C28',
      border: '#262C3E',
      accent: '#6366F1',
      previewDots: ['#090A0F', '#6366F1', '#EC4899'],
    },
  },
  'midnight-nebula': {
    id: 'midnight-nebula',
    name: 'Midnight Nebula',
    tagline: 'Cyberpunk Violet Glow',
    mode: 'dark',
    emoji: '🌌',
    colors: {
      bg: '#0B0814',
      surface: '#140F24',
      card: '#1C1533',
      border: '#312356',
      accent: '#A855F7',
      previewDots: ['#0B0814', '#A855F7', '#EC4899'],
    },
  },
  'emerald-forest': {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    tagline: 'Nordic Pine & Matrix Mint',
    mode: 'dark',
    emoji: '🌲',
    colors: {
      bg: '#050E0B',
      surface: '#0B1B15',
      card: '#11261E',
      border: '#1D3B2F',
      accent: '#10B981',
      previewDots: ['#050E0B', '#10B981', '#34D399'],
    },
  },
  'sunset-amber': {
    id: 'sunset-amber',
    name: 'Sunset Amber',
    tagline: 'Warm Espresso & Bronze Glow',
    mode: 'dark',
    emoji: '☕',
    colors: {
      bg: '#0F0C0A',
      surface: '#1B1612',
      card: '#261F1A',
      border: '#3E3228',
      accent: '#F59E0B',
      previewDots: ['#0F0C0A', '#F59E0B', '#EF4444'],
    },
  },
  'arctic-frost': {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    tagline: 'Titanium Ice & Polar Blue',
    mode: 'dark',
    emoji: '❄️',
    colors: {
      bg: '#070D14',
      surface: '#0E1724',
      card: '#152233',
      border: '#233750',
      accent: '#06B6D4',
      previewDots: ['#070D14', '#06B6D4', '#3B82F6'],
    },
  },
  'pure-light': {
    id: 'pure-light',
    name: 'Pure Light',
    tagline: 'Daylight Slate & Clean Contrast',
    mode: 'light',
    emoji: '☀️',
    colors: {
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      card: '#F1F5F9',
      border: '#E2E8F0',
      accent: '#4F46E5',
      previewDots: ['#FFFFFF', '#4F46E5', '#06B6D4'],
    },
  },
};

export const THEME_LIST: ThemeDefinition[] = Object.values(PRISM_THEMES);

/**
 * Applies the selected theme to the root HTML document and updates CSS variables & color-scheme.
 */
export function applyPrismTheme(themeId: PrismThemeId = 'prism-deep'): void {
  const def = PRISM_THEMES[themeId] ?? PRISM_THEMES['prism-deep'];
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', def.id);
  root.style.setProperty('--prism-bg', def.colors.bg);
  root.style.setProperty('--prism-surface', def.colors.surface);
  root.style.setProperty('--prism-card', def.colors.card);
  root.style.setProperty('--prism-border', def.colors.border);
  root.style.setProperty('--prism-accent', def.colors.accent);

  if (def.mode === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }

  // Update <meta name="color-scheme"> so Chromium and Windows DWM draw matching window shadows
  const meta = document.getElementById('prism-color-scheme') as HTMLMetaElement | null;
  if (meta) {
    meta.content = def.mode;
  }
}
