#!/usr/bin/env node
// Builds the icon set from icons/<variant>/<name>.svg and the brand logos
// from icons/brands/<name>.svg into dist/.
//
// Outputs:
//   dist/icons.json            { [name]: { [variant]: "<svg…>" } }
//   dist/brands.json           { [name]: "<svg…>" }
//   dist/index.js / index.d.ts  ESM exports (userOutline, userSolid, icons, getIcon,
//                               githubBrand, brands, getBrand)
//   dist/sprite/<variant>.svg   <symbol id="<name>"> sprite per variant
//   dist/sprite/brands.svg      <symbol id="<name>"> sprite of the brand logos
//   index.html                  searchable icon browser (repo root, committed)
//
// Search keywords live in icons/tags.json ({ "user": ["person", …] }) and
// icons/brands/tags.json ({ "x": ["twitter"] }).
// Run with --check to validate the sources and confirm index.html is current,
// without writing anything.

import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite } from "./site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "icons");
const DIST = join(ROOT, "dist");
const SITE = join(ROOT, "index.html");
const CHECK_ONLY = process.argv.includes("--check");

// Every icon must ship in each of these variants. Add a new folder under
// icons/ and list it here to introduce another style (e.g. "mini").
const VARIANTS = ["outline", "solid"];
// Brand logos are a separate, single-variant collection. They follow the same
// rules as the UI icons, apart from the variant requirement.
const BRANDS = "brands";
const VIEWBOX = "0 0 24 24";
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ALLOWED_PAINT = new Set(["none", "currentColor"]);

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

function validate(svg, file) {
  const root = svg.match(/<svg\b[^>]*>/);
  if (!root) return fail(file, "no <svg> root element");
  if (!root[0].includes(`viewBox="${VIEWBOX}"`)) fail(file, `viewBox must be "${VIEWBOX}"`);
  if (/\s(width|height)=/.test(root[0])) fail(file, "remove width/height from <svg>; size is set by the consumer");
  for (const [, attr, value] of svg.matchAll(/\s(fill|stroke)="([^"]*)"/g)) {
    if (!ALLOWED_PAINT.has(value)) fail(file, `${attr}="${value}" — use currentColor or none so icons inherit color`);
  }
  if (/\sstyle=|<style\b|\sclass=|\sid=/.test(svg)) fail(file, "no style, class or id attributes");
  if (!/<(path|circle|ellipse|rect|line|polyline|polygon)\b/.test(svg)) fail(file, "icon has no shapes yet");
}

// Collapse whitespace so the shipped strings are compact.
const minify = (svg) =>
  svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .replace(/\s*\/>/g, "/>")
    .trim();

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

async function load() {
  const icons = {};
  for (const variant of VARIANTS) {
    let files;
    try {
      files = (await readdir(join(SRC, variant))).filter((f) => f.endsWith(".svg"));
    } catch {
      fail(`icons/${variant}`, "variant folder is missing");
      continue;
    }
    for (const file of files.sort()) {
      const name = file.slice(0, -4);
      const rel = `icons/${variant}/${file}`;
      if (!NAME_RE.test(name)) fail(rel, "file name must be kebab-case");
      const svg = await readFile(join(SRC, variant, file), "utf8");
      validate(svg, rel);
      (icons[name] ??= {})[variant] = minify(svg);
    }
  }
  for (const [name, variants] of Object.entries(icons)) {
    for (const v of VARIANTS) if (!variants[v]) fail(`icons/${v}/${name}.svg`, "missing (every icon needs all variants)");
  }
  return Object.fromEntries(Object.entries(icons).sort(([a], [b]) => a.localeCompare(b)));
}

// Brands: icons/brands/<name>.svg → { [name]: "<svg…>" }. Only .svg files are
// icons; tags.json and anything else in the folder is ignored here.
async function loadBrands() {
  let files;
  try {
    files = (await readdir(join(SRC, BRANDS))).filter((f) => f.endsWith(".svg"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return {};
  }
  const brands = {};
  for (const file of files.sort()) {
    const name = file.slice(0, -4);
    const rel = `icons/${BRANDS}/${file}`;
    if (!NAME_RE.test(name)) fail(rel, "file name must be kebab-case");
    else if (!/^[a-z]/.test(name)) fail(rel, `file name must start with a letter (it becomes the export ${camel(name)}Brand)`);
    const svg = await readFile(join(SRC, BRANDS, file), "utf8");
    validate(svg, rel);
    brands[name] = minify(svg);
  }
  return Object.fromEntries(Object.entries(brands).sort(([a], [b]) => a.localeCompare(b)));
}

async function loadTags(icons, rel = "icons/tags.json", kind = "an icon") {
  let tags = {};
  try {
    tags = JSON.parse(await readFile(join(ROOT, rel), "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") fail(rel, `invalid JSON (${e.message})`);
    return {};
  }
  for (const [name, list] of Object.entries(tags)) {
    if (!icons[name]) fail(rel, `"${name}" is not ${kind}`);
    if (!Array.isArray(list) || !list.every((t) => typeof t === "string")) fail(rel, `"${name}" must be an array of strings`);
  }
  return tags;
}

// entries: [[name, "<svg…>"], …]
function sprite(entries) {
  const symbols = entries.map(([name, svg]) =>
    svg
      .replace(/^<svg\b([^>]*)>/, (_, attrs) => `<symbol id="${name}"${attrs.replace(/\sxmlns="[^"]*"/, "")}>`)
      .replace(/<\/svg>$/, "</symbol>"),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>\n`;
}

// Brand exports end in "Brand" and UI exports in a variant name, so they only
// clash if a variant is ever called "brand". Catch that rather than emit
// duplicate exports.
function checkExports(icons, brands) {
  const seen = new Set();
  for (const name of Object.keys(icons)) for (const v of VARIANTS) seen.add(camel(`${name}-${v}`));
  for (const name of Object.keys(brands)) {
    const id = `${camel(name)}Brand`;
    if (seen.has(id)) fail(`icons/${BRANDS}/${name}.svg`, `export ${id} clashes with another export`);
    seen.add(id);
  }
}

function esm(icons, brands) {
  const lines = [
    "// Generated by scripts/build.mjs — do not edit.",
    `export const variants = ${JSON.stringify(VARIANTS)};`,
  ];
  for (const [name, v] of Object.entries(icons)) {
    for (const variant of VARIANTS) lines.push(`export const ${camel(`${name}-${variant}`)} = ${JSON.stringify(v[variant])};`);
  }
  lines.push(`export const icons = ${JSON.stringify(icons, null, 2)};`);
  lines.push(
    "export function getIcon(name, variant = \"outline\") {",
    "  const svg = icons[name]?.[variant];",
    "  if (!svg) throw new Error(`Unknown icon: ${name} (${variant})`);",
    "  return svg;",
    "}",
  );
  for (const [name, svg] of Object.entries(brands)) lines.push(`export const ${camel(name)}Brand = ${JSON.stringify(svg)};`);
  lines.push(`export const brands = ${JSON.stringify(brands, null, 2)};`);
  lines.push(
    "export function getBrand(name) {",
    "  const svg = Object.hasOwn(brands, name) ? brands[name] : undefined;",
    "  if (!svg) throw new Error(`Unknown brand: ${name}`);",
    "  return svg;",
    "}",
  );
  return lines.join("\n") + "\n";
}

function dts(icons, brands) {
  const names = Object.keys(icons).map((n) => JSON.stringify(n)).join(" | ") || "never";
  const lines = [
    "// Generated by scripts/build.mjs — do not edit.",
    `export type IconName = ${names};`,
    `export type IconVariant = ${VARIANTS.map((v) => JSON.stringify(v)).join(" | ")};`,
    "export declare const variants: readonly IconVariant[];",
  ];
  for (const name of Object.keys(icons)) {
    for (const variant of VARIANTS) lines.push(`export declare const ${camel(`${name}-${variant}`)}: string;`);
  }
  lines.push(
    "export declare const icons: Record<IconName, Record<IconVariant, string>>;",
    "export declare function getIcon(name: IconName, variant?: IconVariant): string;",
  );
  lines.push(`export type BrandName = ${Object.keys(brands).map((n) => JSON.stringify(n)).join(" | ") || "never"};`);
  for (const name of Object.keys(brands)) lines.push(`export declare const ${camel(name)}Brand: string;`);
  lines.push(
    "export declare const brands: Record<BrandName, string>;",
    "export declare function getBrand(name: BrandName): string;",
  );
  return lines.join("\n") + "\n";
}

const icons = await load();
const tags = await loadTags(icons);
const brands = await loadBrands();
const brandTags = await loadTags(brands, `icons/${BRANDS}/tags.json`, "a brand");
checkExports(icons, brands);
const site = renderSite({ icons, tags, variants: VARIANTS, brands, brandTags });

if (errors.length) {
  console.error(`✖ ${errors.length} problem(s):\n  ` + errors.join("\n  "));
  process.exit(1);
}

const count = Object.keys(icons).length;
const brandCount = Object.keys(brands).length;
if (CHECK_ONLY) {
  const current = await readFile(SITE, "utf8").catch(() => "");
  if (current !== site) {
    console.error("✖ index.html is out of date — run `npm run build` and commit it");
    process.exit(1);
  }
  console.log(`✔ ${count} icon(s) × ${VARIANTS.length} variants and ${brandCount} brand(s) valid`);
  process.exit(0);
}

await rm(DIST, { recursive: true, force: true });
await mkdir(join(DIST, "sprite"), { recursive: true });
await Promise.all([
  writeFile(join(DIST, "icons.json"), JSON.stringify(icons, null, 2) + "\n"),
  writeFile(join(DIST, "brands.json"), JSON.stringify(brands, null, 2) + "\n"),
  writeFile(join(DIST, "index.js"), esm(icons, brands)),
  writeFile(join(DIST, "index.d.ts"), dts(icons, brands)),
  writeFile(SITE, site),
  ...VARIANTS.map((v) => writeFile(join(DIST, "sprite", `${v}.svg`), sprite(Object.entries(icons).map(([name, s]) => [name, s[v]])))),
  writeFile(join(DIST, "sprite", `${BRANDS}.svg`), sprite(Object.entries(brands))),
]);
console.log(`✔ Built ${count} icon(s) × ${VARIANTS.length} variants and ${brandCount} brand(s) → dist/ and index.html`);
