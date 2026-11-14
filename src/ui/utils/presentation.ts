import type { ChromeTabGroupColor, PrismSettings, ThemeId } from '../../domain/types';

export interface ThemePreviewSpec {
  canvas: string;
  surface: string;
  accent: string;
  toneLabel: string;
}

export const THEME_PALETTE_PREVIEW: Record<ThemeId, ThemePreviewSpec> = {
  system: {
    canvas: '#0b0e17',
    surface: '#f7f8fb',
    accent: '#6366f1',
    toneLabel: 'Adaptive OS',
  },
  'prism-deep': {
    canvas: '#0b0e17',
    surface: '#1a2136',
    accent: '#818cf8',
    toneLabel: 'Cosmic Indigo',
  },
  'midnight-nebula': {
    canvas: '#0f0b1a',
    surface: '#211938',
    accent: '#c084fc',
    toneLabel: 'Ultraviolet',
  },
  'emerald-forest': {
    canvas: '#081410',
    surface: '#162d25',
    accent: '#34d399',
    toneLabel: 'Pine & Mint',
  },
  'sunset-amber': {
    canvas: '#16100b',
    surface: '#2c2017',
    accent: '#fbbf24',
    toneLabel: 'Warm Espresso',
  },
  'arctic-frost': {
    canvas: '#08131a',
    surface: '#152b3b',
    accent: '#38bdf8',
    toneLabel: 'Glacial Slate',
  },
  'pure-light': {
    canvas: '#f7f8fb',
    surface: '#e5eaf4',
    accent: '#4338ca',
    toneLabel: 'Crisp Daylight',
  },
};

export const CHROME_COLOR_LABELS: Record<ChromeTabGroupColor, string> = {
  grey: 'Grey',
  blue: 'Blue',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  pink: 'Pink',
  purple: 'Purple',
  cyan: 'Cyan',
  orange: 'Orange',
};

export function getSafeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function getAiStatusBadge(settings: PrismSettings): { label: string; ready: boolean } {
  if (settings.aiProvider === 'groq') {
    return {
      label: settings.groqApiKey.trim().length > 0 ? 'Groq' : 'Groq · Key?',
      ready: settings.groqApiKey.trim().length > 0,
    };
  }
  if (settings.aiProvider === 'gemini') {
    return {
      label: settings.geminiApiKey.trim().length > 0 ? 'Gemini' : 'Gemini · Key?',
      ready: settings.geminiApiKey.trim().length > 0,
    };
  }
  const hasCustom =
    settings.customApiKey.trim().length > 0 && settings.customBaseUrl.trim().length > 0;
  return {
    label: hasCustom ? 'Custom' : 'Custom · Key?',
    ready: hasCustom,
  };
}

export function resolveTabListNextIndex(
  currentIndex: number,
  length: number,
  key: string,
): number | null {
  if (length <= 0 || currentIndex < 0) return null;
  if (key === 'ArrowRight') {
    return (currentIndex + 1) % length;
  }
  if (key === 'ArrowLeft') {
    return (currentIndex - 1 + length) % length;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return length - 1;
  }
  return null;
}

export function handleTabListKeyDown<T extends string>(
  event: KeyboardEvent,
  items: readonly T[],
  active: T,
  onSelect: (item: T) => void,
): void {
  const currentIndex = items.indexOf(active);
  const nextIndex = resolveTabListNextIndex(currentIndex, items.length, event.key);
  if (nextIndex === null) return;

  const nextItem = items[nextIndex];
  if (nextItem === undefined) return;

  event.preventDefault();
  onSelect(nextItem);

  const currentTarget = event.currentTarget;
  if (typeof HTMLElement !== 'undefined' && currentTarget instanceof HTMLElement) {
    const tablist = currentTarget.closest('[role="tablist"]');
    const tabs = tablist?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  }
}
