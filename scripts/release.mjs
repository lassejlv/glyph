#!/usr/bin/env node
// Bumps the version, publishes to npm and pushes the release commit + tag.
//
//   npm run release              # patch: 0.1.0 → 0.1.1
//   npm run release -- minor     # 0.1.0 → 0.2.0
//   npm run release -- major     # 0.1.0 → 1.0.0
//   npm run release -- 1.2.3     # an exact version
//   npm run release -- --dry-run # show what would happen, change nothing
//
// Steps: check you're on an up-to-date, clean main and logged in to npm →
// build + check → bump version (commit "Release vX.Y.Z" + tag) → npm publish
// → git push with the tag. If publishing fails, the version commit and tag are
// undone so you can fix the problem and run it again.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRANCH = "main";
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const bump = args.find((a) => !a.startsWith("--")) ?? "patch";

const run = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });
const read = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const step = (msg) => console.log(`\n▸ ${msg}`);
const die = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};

if (!/^(patch|minor|major|\d+\.\d+\.\d+(-[\w.]+)?)$/.test(bump)) {
  die(`Unknown version "${bump}". Use patch, minor, major or an exact version like 1.2.3.`);
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

function next(current, kind) {
  if (/^\d/.test(kind)) return kind;
  const [ma, mi, pa] = current.split("-")[0].split(".").map(Number);
  if (kind === "major") return `${ma + 1}.0.0`;
  if (kind === "minor") return `${ma}.${mi + 1}.0`;
  return `${ma}.${mi}.${pa + 1}`;
}

const newer = (a, b) => {
  const pa = a.split("-")[0].split(".").map(Number), pb = b.split("-")[0].split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return false;
};

// 1. Preconditions
step("Checking git");
const branch = read("git rev-parse --abbrev-ref HEAD");
if (branch !== BRANCH) die(`You're on "${branch}". Switch to ${BRANCH} first.`);
if (read("git status --porcelain")) die("You have uncommitted changes. Commit or stash them first.");
run(`git fetch --quiet origin ${BRANCH}`);
const [behind, ahead] = read(`git rev-list --left-right --count origin/${BRANCH}...HEAD`).split(/\s+/).map(Number);
if (behind) die(`Your ${BRANCH} is ${behind} commit(s) behind origin. Run: git pull`);
if (ahead) console.log(`  (${ahead} local commit(s) not pushed yet; they'll be pushed with the release)`);

step("Checking npm");
let user = "";
try {
  user = read("npm whoami");
} catch {
  if (!DRY) die("You're not logged in to npm. Run: npm login");
}
if (user) console.log(`  logged in as ${user}`);

let published = null;
try {
  published = read(`npm view ${pkg.name} version`);
} catch {
  // Not on npm yet: first publish.
}
const version = next(pkg.version, bump);
console.log(`  ${pkg.name}: local ${pkg.version}, on npm ${published ?? "(not published yet)"} → releasing ${version}`);
if (published && !newer(version, published)) die(`${version} is not newer than the published ${published}.`);
if (read("git tag --list").split("\n").includes(`v${version}`)) die(`Tag v${version} already exists.`);

// 2. Build and validate
step("Building and checking");
run("npm run --silent build");
run("npm run --silent check");
if (read("git status --porcelain")) die("The build changed tracked files (e.g. index.html). Commit them, then run the release again.");

if (DRY) {
  step("Dry run: package contents");
  run("npm pack --dry-run");
  console.log(`\n✔ Dry run done. A real run would release ${pkg.name}@${version}, tag v${version} and push to origin/${BRANCH}.`);
  process.exit(0);
}

// 3. Bump, publish, push
step(`Bumping version to ${version}`);
run(`npm version ${version} -m "Release v%s"`);

step("Publishing to npm");
try {
  // --access public lets a scoped name publish publicly too; harmless otherwise.
  run("npm publish --access public");
} catch {
  console.error("\nPublish failed. Undoing the version commit and tag…");
  run(`git tag -d v${version}`);
  run("git reset --hard HEAD~1");
  die("Nothing was released. Fix the problem above and run the release again.");
}

step("Pushing to GitHub");
run(`git push origin ${BRANCH} --follow-tags`);

console.log(`\n✔ Released ${pkg.name}@${version}`);
console.log(`  https://www.npmjs.com/package/${pkg.name}`);
