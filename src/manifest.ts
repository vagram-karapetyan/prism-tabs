export interface ChromeMv3Manifest {
  manifest_version: 3;
  name: string;
  short_name: string;
  version: string;
  version_name?: string;
  description: string;
  permissions: readonly ['tabs', 'tabGroups', 'storage'];
  icons: Record<'16' | '32' | '48' | '128', string>;
  background: {
    service_worker: 'background.js';
    type: 'module';
  };
  action: {
    default_popup: 'popup.html';
    default_title: string;
    default_icon: Record<'16' | '32' | '48' | '128', string>;
  };
  commands: {
    'prism-sort-tabs': {
      suggested_key: { default: string; mac: string };
      description: string;
    };
    'prism-ungroup-all': {
      suggested_key: { default: string; mac: string };
      description: string;
    };
  };
}

/**
 * Converts a SemVer string (e.g. "2.0.0-alpha.1") into a Chrome MV3-compatible
 * numeric version ("2.0.0") because manifest `version` only permits 1-4 dot-separated integers.
 */
export function toChromeManifestVersion(semver: string): string {
  const trimmed = semver.trim().replace(/^v/i, '');
  const numericPart = trimmed.split(/[-+]/)[0] ?? '';
  if (!/^\d+(\.\d+){0,3}$/.test(numericPart)) {
    throw new Error(`Invalid SemVer for Chrome manifest version: "${semver}"`);
  }
  return numericPart;
}

const ICONS = {
  '16': 'icons/icon-16.png',
  '32': 'icons/icon-32.png',
  '48': 'icons/icon-48.png',
  '128': 'icons/icon-128.png',
} as const;

export function buildManifest(canonicalVersion: string): ChromeMv3Manifest {
  const numericVersion = toChromeManifestVersion(canonicalVersion);
  const manifest: ChromeMv3Manifest = {
    manifest_version: 3,
    name: 'Prism — Dual-Engine Tab Organizer',
    short_name: 'Prism',
    version: numericVersion,
    description:
      'Eliminate tab overload with instant deterministic Logic grouping and privacy-first AI semantic clustering (Groq / Gemini / Custom BYOK).',
    permissions: ['tabs', 'tabGroups', 'storage'],
    icons: { ...ICONS },
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    action: {
      default_popup: 'popup.html',
      default_title: 'Prism — Organize Tabs (Alt+P)',
      default_icon: { ...ICONS },
    },
    commands: {
      'prism-sort-tabs': {
        suggested_key: {
          default: 'Alt+P',
          mac: 'Command+Shift+P',
        },
        description: 'Instantly group tabs in current window using active Prism engine',
      },
      'prism-ungroup-all': {
        suggested_key: {
          default: 'Alt+U',
          mac: 'Command+Shift+U',
        },
        description: 'Ungroup all tabs in the current window',
      },
    },
  };

  if (canonicalVersion !== numericVersion) {
    manifest.version_name = canonicalVersion;
  }

  return manifest;
}
