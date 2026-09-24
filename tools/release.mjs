#!/usr/bin/env node
/**
 * OYA — release version stamper.
 *
 *   node tools/release.mjs            bump to today's next build
 *   node tools/release.mjs --check    verify lockstep, change nothing (CI)
 *   node tools/release.mjs 2026.10.01.1   set an explicit version
 *   node tools/release.mjs --dry-run  show what would change
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * Three files must carry the identical version string:
 *
 *   frontend/assets/js/config.js   APP_VERSION   what the running page reports
 *   frontend/version.json          version       what the server advertises
 *   frontend/sw.js                 APP_VERSION   what names the caches
 *
 * pwa.js compares config.js's APP_VERSION against the live version.json to
 * decide whether a newer deployment exists. sw.js embeds the version in its
 * cache names so activating a new worker drops the old caches.
 *
 * Every failure mode of editing these by hand is silent and user-visible:
 *
 *   config.js ahead of version.json  -> the app never detects an update
 *   config.js behind version.json    -> "update available" prompts forever
 *   sw.js not bumped                 -> old caches are never dropped, so users
 *                                       keep getting stale assets until the
 *                                       3-day TTL expires
 *
 * None of these throw an error. They just quietly strand users on an old
 * build — exactly the situation the two-mechanism cache design exists to
 * prevent. So the bump is automated and `--check` is runnable in CI.
 *
 * Deliberately dependency-free, like the rest of the frontend. No npm install.
 * ---------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Each target: the file, the pattern that finds the version, how to rewrite. */
const TARGETS = [
  {
    file: "frontend/assets/js/config.js",
    label: "config.js APP_VERSION",
    read: /const APP_VERSION = "([^"]+)"/,
    write: (src, v) =>
      src.replace(/const APP_VERSION = "[^"]+"/, `const APP_VERSION = "${v}"`),
  },
  {
    file: "frontend/sw.js",
    label: "sw.js APP_VERSION",
    read: /const APP_VERSION = "([^"]+)"/,
    write: (src, v) =>
      src.replace(/const APP_VERSION = "[^"]+"/, `const APP_VERSION = "${v}"`),
  },
  {
    file: "frontend/version.json",
    label: "version.json version",
    read: /"version"\s*:\s*"([^"]+)"/,
    write: (src, v) => {
      // Rewrite the whole document so builtAt travels with the version, but
      // keep any other keys a future build step may have added.
      const data = JSON.parse(src);
      data.version = v;
      data.builtAt = new Date().toISOString();
      return JSON.stringify(data, null, 2) + "\n";
    },
  },
];

const VERSION_RE = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;

/* ─────────────────────────────── helpers ─────────────────────────────── */

const read = (file) => readFileSync(resolve(ROOT, file), "utf8");

function currentVersions() {
  return TARGETS.map((t) => {
    const src = read(t.file);
    const match = t.read.exec(src);
    if (!match) {
      fail(`could not find a version in ${t.file} — has its format changed?`);
    }
    return { ...t, src, version: match[1] };
  });
}

/** Today's date in the YYYY.MM.DD prefix, using LOCAL time. */
function todayPrefix() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
}

/**
 * Next version: same day -> increment the build counter, new day -> start at 1.
 * Never goes backwards, even if the clock does.
 */
function nextVersion(current) {
  const prefix = todayPrefix();
  if (current.startsWith(prefix + ".")) {
    const build = Number(current.slice(prefix.length + 1));
    return `${prefix}.${build + 1}`;
  }
  // If the existing version is somehow in the future, bump it rather than
  // regress — a lower version would make pwa.js stop detecting updates.
  if (current > prefix) {
    const parts = current.split(".");
    parts[3] = String(Number(parts[3]) + 1);
    return parts.join(".");
  }
  return `${prefix}.1`;
}

function fail(message) {
  console.error(`\x1b[31merror:\x1b[0m ${message}`);
  process.exit(1);
}

/* ──────────────────────────────── modes ──────────────────────────────── */

function check(entries) {
  const versions = [...new Set(entries.map((e) => e.version))];

  console.log("\n  Version lockstep\n");
  for (const entry of entries) {
    console.log(`    ${entry.version.padEnd(16)} ${entry.label}`);
  }
  console.log("");

  if (versions.length !== 1) {
    console.error(
      "\x1b[31m  ✗ MISMATCH\x1b[0m — these files must all carry the same version.\n" +
      "    Run: node tools/release.mjs\n"
    );
    return false;
  }
  if (!VERSION_RE.test(versions[0])) {
    console.error(
      `\x1b[31m  ✗ BAD FORMAT\x1b[0m — "${versions[0]}" is not YYYY.MM.DD.N\n`
    );
    return false;
  }
  console.log(`\x1b[32m  ✓ all three agree on ${versions[0]}\x1b[0m\n`);
  return true;
}

function bump(entries, target, dryRun) {
  console.log(`\n  ${dryRun ? "Would set" : "Setting"} version to \x1b[1m${target}\x1b[0m\n`);

  for (const entry of entries) {
    const updated = entry.write(entry.src, target);
    if (updated === entry.src) {
      console.log(`    \x1b[2m= ${entry.label} (already ${target})\x1b[0m`);
      continue;
    }
    if (!dryRun) writeFileSync(resolve(ROOT, entry.file), updated);
    console.log(`    ${dryRun ? "~" : "\x1b[32m✓\x1b[0m"} ${entry.label}: ${entry.version} -> ${target}`);
  }

  if (dryRun) {
    console.log("\n  (dry run — nothing written)\n");
    return;
  }

  // Re-read from disk and verify, rather than trusting the write.
  const after = currentVersions();
  const distinct = [...new Set(after.map((e) => e.version))];
  if (distinct.length !== 1 || distinct[0] !== target) {
    fail(`post-write verification failed — files now read ${distinct.join(", ")}`);
  }

  console.log(
    "\n\x1b[32m  ✓ all three files now read " + target + "\x1b[0m\n\n" +
    "  Next:\n" +
    "    1. ./run-tests.sh          (the lockstep test will confirm this)\n" +
    "    2. commit all three files together — never separately\n" +
    "    3. deploy frontend and backend\n"
  );
}

/* ──────────────────────────────── main ───────────────────────────────── */

const args = process.argv.slice(2);
const entries = currentVersions();

if (args.includes("--help") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8")
    .split("*/")[0].replace(/^\/\*\*?|^ \* ?/gm, ""));
  process.exit(0);
}

if (args.includes("--check")) {
  process.exit(check(entries) ? 0 : 1);
}

const dryRun = args.includes("--dry-run");
const explicit = args.find((a) => !a.startsWith("--"));

if (explicit && !VERSION_RE.test(explicit)) {
  fail(`"${explicit}" is not a valid version — expected YYYY.MM.DD.N (e.g. ${todayPrefix()}.1)`);
}

// Bump from the highest version present, so a partially-edited working tree
// can never produce a version lower than one already shipped.
const highest = entries.map((e) => e.version).sort().pop();
bump(entries, explicit || nextVersion(highest), dryRun);
