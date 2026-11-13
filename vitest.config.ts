import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'),
) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
