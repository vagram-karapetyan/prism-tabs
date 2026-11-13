import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
import { buildManifest } from './src/manifest';

interface PackageJson {
  version: string;
}

function readCanonicalVersion(): string {
  const pkgPath = resolve(import.meta.dirname, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson;
  return pkg.version;
}

function generateManifestPlugin(version: string): Plugin {
  return {
    name: 'prism-generate-manifest',
    generateBundle() {
      const manifest = buildManifest(version);
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
    },
  };
}

const appVersion = readCanonicalVersion();

export default defineConfig({
  plugins: [preact(), generateManifestPlugin(appVersion)],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'popup.html'),
        background: resolve(import.meta.dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
