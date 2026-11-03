import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const PKG_PATH = path.join(ROOT_DIR, 'package.json');
const DIST_RELEASE_DIR = path.join(ROOT_DIR, 'dist-release');
const RELEASES_DIR = path.join(ROOT_DIR, 'releases');

console.log('🚀 Starting Clean Release Packaging for Prism Tabs...\n');

// 1. Read version from package.json
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const version = pkg.version || '1.0.0';
console.log(`📦 Packaging version: v${version}`);

// 2. Typecheck
console.log('\n🔍 Running TypeScript typecheck...');
execSync('npx tsc --noEmit', { stdio: 'inherit', cwd: ROOT_DIR });

// 3. Clean previous build if any
if (fs.existsSync(DIST_RELEASE_DIR)) {
  fs.rmSync(DIST_RELEASE_DIR, { recursive: true, force: true });
}

// 4. Build extension in release mode (zero API keys injected)
console.log('\n🔨 Compiling clean release bundle (mode: release)...');
execSync('npx vite build --mode release', { stdio: 'inherit', cwd: ROOT_DIR });

if (!fs.existsSync(DIST_RELEASE_DIR)) {
  throw new Error(`Build failed: ${DIST_RELEASE_DIR} does not exist!`);
}

// 5. Automated Security & Secret Leak Audit
console.log('\n🛡️ Running security audit for sensitive credentials...');
function auditDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      auditDir(full);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (['.js', '.html', '.css', '.json', '.txt'].includes(ext)) {
        const content = fs.readFileSync(full, 'utf8');
        // Check for Groq API keys (gsk_...)
        if (/gsk_[A-Za-z0-9_-]{20,}/.test(content)) {
          throw new Error(`CRITICAL SECURITY FAILURE: Found leaked Groq key in ${file}!`);
        }
        // Check for Gemini API keys (AIza...)
        if (/AIza[0-9A-Za-z-_]{35}/.test(content)) {
          throw new Error(`CRITICAL SECURITY FAILURE: Found leaked Gemini key in ${file}!`);
        }
      }
    }
  }
}
auditDir(DIST_RELEASE_DIR);
console.log('✅ Security audit passed: ZERO personal keys or secrets found in bundle.');

// 6. Prepare releases directory
if (!fs.existsSync(RELEASES_DIR)) {
  fs.mkdirSync(RELEASES_DIR, { recursive: true });
}

const unpackedDest = path.join(RELEASES_DIR, `prism-tabs-v${version}`);
const zipDest = path.join(RELEASES_DIR, `prism-tabs-v${version}.zip`);

// Clean previous unpacked folder and zip
if (fs.existsSync(unpackedDest)) {
  fs.rmSync(unpackedDest, { recursive: true, force: true });
}
if (fs.existsSync(zipDest)) {
  fs.rmSync(zipDest, { force: true });
}

// Copy dist-release to unpacked release directory
fs.cpSync(DIST_RELEASE_DIR, unpackedDest, { recursive: true });
console.log(`\n📁 Created clean unpacked folder: releases/prism-tabs-v${version}`);

// 7. Compress into .zip
console.log('🗜️ Creating distribution ZIP archive...');
const psCommand = `powershell -NoProfile -Command "Compress-Archive -Path '${unpackedDest}\\*' -DestinationPath '${zipDest}' -Force"`;
execSync(psCommand, { stdio: 'inherit', cwd: ROOT_DIR });

const zipSizeKb = (fs.statSync(zipDest).size / 1024).toFixed(1);
console.log(`\n🎉 Release successfully packaged!`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📦 Version:        v${version}`);
console.log(`🔒 Security:       Clean BYOK (Zero Hardcoded Secrets)`);
console.log(`📁 Unpacked Folder: releases/prism-tabs-v${version}/`);
console.log(`🗜️ ZIP Archive:    releases/prism-tabs-v${version}.zip (${zipSizeKb} KB)`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
