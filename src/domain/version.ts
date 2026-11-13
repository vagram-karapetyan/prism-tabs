/**
 * Canonical application version injected at build/test time from package.json.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0
    ? __APP_VERSION__
    : '2.0.0-alpha.1';
