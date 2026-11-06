import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const PKG_PATH = path.join(ROOT_DIR, 'package.json');
const RELEASES_DIR = path.join(ROOT_DIR, 'releases');

console.log('🚀 Initiating automated GitHub Release publication...\n');

// 1. Read version
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const version = pkg.version;
const tag = `v${version}`;
const zipFile = path.join(RELEASES_DIR, `prism-tabs-v${version}.zip`);
const notesFile = path.join(RELEASES_DIR, `RELEASE_NOTES_v${version}.md`);

// 2. Ensure package zip exists
if (!fs.existsSync(zipFile)) {
  console.log('📦 ZIP archive not found. Running package-release script...');
  execSync('node scripts/package-release.mjs', { stdio: 'inherit', cwd: ROOT_DIR });
}

// 3. Verify gh CLI is installed and authenticated
try {
  execSync('gh auth status', { stdio: 'ignore' });
} catch {
  console.error('❌ GitHub CLI (gh) is not authenticated. Please run "gh auth login".');
  process.exit(1);
}

// 4. Check if release already exists on GitHub
try {
  const existing = execSync(`gh release view ${tag}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  if (existing.includes(tag)) {
    console.log(`ℹ️ GitHub release ${tag} already exists.`);
    process.exit(0);
  }
} catch {
  // Release does not exist yet, proceed
}

// 5. Create release notes if missing
if (!fs.existsSync(notesFile)) {
  const defaultNotes = `### Prism Tabs v${version}\n\n- Automated release package for Prism Tabs v${version}.\n- Clean BYOK build with zero hardcoded credentials.\n- Ready for manual installation via Chrome "Load unpacked" or from ZIP.\n`;
  fs.writeFileSync(notesFile, defaultNotes, 'utf8');
}

// 6. Create GitHub release
console.log(`🌐 Publishing release ${tag} to GitHub...`);
try {
  execSync(`gh release create ${tag} "${zipFile}" --title "Prism Tabs v${version}" --notes-file "${notesFile}"`, {
    stdio: 'inherit',
    cwd: ROOT_DIR,
  });
  console.log(`\n🎉 Successfully published ${tag} to GitHub Releases!`);
} catch (err) {
  console.error(`❌ Failed to publish release ${tag}:`, err);
  process.exit(1);
}
