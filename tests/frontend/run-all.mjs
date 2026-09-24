import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const frontend = path.join(root, 'frontend');
let failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error('FAIL', message);
  } else {
    console.log('PASS', message);
  }
}

function walk(dir, predicate = () => true) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, predicate));
    else if (predicate(p)) out.push(p);
  }
  return out;
}

function refsFromHtml(file) {
  const text = fs.readFileSync(file, 'utf8');
  const refs = [];
  const re = /<(?:script|link|img)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(text))) {
    const ref = m[1].split('?')[0];
    if (/^(?:https?:)?\/\//.test(ref) || ref.startsWith('#') || ref.startsWith('mailto:') || ref.startsWith('tel:') || ref.startsWith('/')) continue;
    refs.push(ref);
  }
  return refs;
}

const htmlFiles = walk(frontend, (p) => p.endsWith('.html'));
const jsFiles = walk(path.join(frontend, 'assets', 'js'), (p) => p.endsWith('.js')).concat(path.join(frontend, 'sw.js'));

// 1. No Django template syntax remains in the standalone frontend.
for (const file of htmlFiles.concat(jsFiles)) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  assert(!/{{|{%|csrf_token/.test(text), `${rel} contains no Django template syntax`);
}

// 2. No inline JavaScript in HTML pages.
for (const file of htmlFiles) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  const inline = [...text.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim());
  assert(inline.length === 0, `${rel} has no inline JavaScript`);
}

// 3. Every local HTML asset reference exists.
for (const file of htmlFiles) {
  for (const ref of refsFromHtml(file)) {
    const target = path.resolve(path.dirname(file), ref);
    assert(target.startsWith(frontend) && fs.existsSync(target), `${path.relative(root, file)} references existing ${ref}`);
  }
}

// 4. JavaScript syntax checks.
for (const file of jsFiles) {
  const rel = path.relative(root, file);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert(result.status === 0, `${rel} passes node --check${result.stderr ? ': ' + result.stderr : ''}`);
}

// 5. Version lockstep between config.js, version.json, and sw.js.
const versionJson = JSON.parse(fs.readFileSync(path.join(frontend, 'version.json'), 'utf8')).version;
const config = fs.readFileSync(path.join(frontend, 'assets/js/config.js'), 'utf8');
const sw = fs.readFileSync(path.join(frontend, 'sw.js'), 'utf8');
const configVersion = (/const APP_VERSION\s*=\s*["']([^"']+)/.exec(config) || /APP_VERSION:\s*["']([^"']+)/.exec(config))?.[1];
const swVersion = /APP_VERSION\s*=\s*["']([^"']+)/.exec(sw)?.[1];
assert(configVersion === versionJson, 'config.js APP_VERSION matches version.json');
assert(swVersion === versionJson, 'sw.js APP_VERSION matches version.json');

// 6. Central API client is loaded by every protected page that has page logic.
for (const file of htmlFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('assets/js/pages/')) {
    assert(text.includes('assets/js/api.js'), `${path.relative(root, file)} loads central api.js`);
  }
}

if (failures) {
  console.error(`\n${failures} frontend check(s) failed.`);
  process.exit(1);
}
console.log('\nFrontend checks passed.');
