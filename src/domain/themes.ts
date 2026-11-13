import { THEME_IDS, type ConcreteThemeId, type ThemeId } from './types';

export interface ThemeDescriptor {
  id: ThemeId;
  label: string;
  description: string;
  isLight: boolean;
  bootBackground: string;
  swatchAccent: string;
}

export const THEME_DESCRIPTORS: readonly ThemeDescriptor[] = [
  {
    id: 'system',
    label: 'Auto / System',
    description: 'Follows OS dark or light preference automatically',
    isLight: false,
    bootBackground: '#0b0e17',
    swatchAccent: '#6366f1',
  },
  {
    id: 'prism-deep',
    label: 'Prism Deep',
    description: 'Deep cosmic indigo with spectral accents',
    isLight: false,
    bootBackground: '#0b0e17',
    swatchAccent: '#818cf8',
  },
  {
    id: 'midnight-nebula',
    label: 'Midnight Nebula',
    description: 'Rich ultraviolet obsidian with neon violet',
    isLight: false,
    bootBackground: '#0f0b1a',
    swatchAccent: '#c084fc',
  },
  {
    id: 'emerald-forest',
    label: 'Emerald Forest',
    description: 'Deep pine surface with crisp mint highlights',
    isLight: false,
    bootBackground: '#081410',
    swatchAccent: '#34d399',
  },
  {
    id: 'sunset-amber',
    label: 'Sunset Amber',
    description: 'Warm espresso dark with golden amber glow',
    isLight: false,
    bootBackground: '#16100b',
    swatchAccent: '#fbbf24',
  },
  {
    id: 'arctic-frost',
    label: 'Arctic Frost',
    description: 'Glacial navy slate with icy cyan highlights',
    isLight: false,
    bootBackground: '#08131a',
    swatchAccent: '#38bdf8',
  },
  {
    id: 'pure-light',
    label: 'Pure Light',
    description: 'Clean high-contrast daylight canvas',
    isLight: true,
    bootBackground: '#f7f8fb',
    swatchAccent: '#4f46e5',
  },
] as const;

const THEME_SET = new Set<string>(THEME_IDS);

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_SET.has(value);
}

export function resolveConcreteTheme(theme: ThemeId, prefersDark: boolean): ConcreteThemeId {
  if (theme === 'system') {
    return prefersDark ? 'prism-deep' : 'pure-light';
  }
  return theme;
}
