import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../src/domain/version';
import { buildManifest, toChromeManifestVersion } from '../src/manifest';

describe('Single Source of Truth versioning & MV3 manifest', () => {
  it('matches package.json version', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8'),
    ) as { version: string };

    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toBe('2.0.0-alpha.1');
  });

  it('converts SemVer prerelease to Chrome-compatible numeric version and preserves version_name', () => {
    expect(toChromeManifestVersion('2.0.0-alpha.1')).toBe('2.0.0');
    expect(toChromeManifestVersion('2.0.0')).toBe('2.0.0');
    expect(() => toChromeManifestVersion('invalid')).toThrow();

    const prereleaseManifest = buildManifest('2.0.0-alpha.1');
    expect(prereleaseManifest.version).toBe('2.0.0');
    expect(prereleaseManifest.version_name).toBe('2.0.0-alpha.1');
    expect(prereleaseManifest.permissions).toEqual(['tabs', 'tabGroups', 'storage']);
    expect(prereleaseManifest.commands['prism-sort-tabs'].suggested_key.default).toBe('Alt+P');
    expect(prereleaseManifest.commands['prism-ungroup-all'].suggested_key.default).toBe('Alt+U');

    const stableManifest = buildManifest('2.0.0');
    expect(stableManifest.version).toBe('2.0.0');
    expect(stableManifest.version_name).toBeUndefined();
  });
});
