#!/usr/bin/env node
// Builds the icon set from icons/<variant>/<name>.svg and the brand logos
// from icons/brands/<name>.svg.
//
// Outputs:
//   dist/index.js, dist/index.cjs      the package: a single getIcon() function
//   dist/index.d.ts, dist/index.d.cts  its types (IconName, BrandName, IconVariant)
//   site/                              the website (git-ignored, deployed by CI):
//     index.html                       icon browser + docs
//     llms.txt                         overview and icon index for LLMs
//     <icon>.svg|.md|.txt              outline SVG, markdown and text per icon
//     outline/<icon>.svg, solid/<icon>.svg
//     brands/<name>.svg|.md|.txt
//
// Search keywords live in icons/tags.json ({ "user": ["person", …] }) and
// icons/brands/tags.json ({ "x": ["twitter"] }).
// Run with --check to validate the sources
// without writing anything.

import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite } from "./site.mjs";
import { llmsTxt, iconMarkdown, iconText } from "./endpoints.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "icons");
const DIST = join(ROOT, "dist");
const SITE = join(ROOT, "site");
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

// The package ships one function. To keep it small, every SVG is stored as
// an index into a shared table of root <svg …> tags plus its inner markup.
function table(icons, brands) {
  const roots = [];
  const split = (svg) => {
    const m = svg.match(/^(<svg\b[^>]*>)([\s\S]*)<\/svg>$/);
    let i = roots.indexOf(m[1]);
    if (i < 0) i = roots.push(m[1]) - 1;
    return [i, m[2]];
  };
  const I = Object.fromEntries(Object.entries(icons).map(([n, v]) => [n, VARIANTS.flatMap((k) => split(v[k]))]));
  const B = Object.fromEntries(Object.entries(brands).map(([n, svg]) => [n, split(svg)]));
  return { roots, I, B };
}

function runtime(icons, brands, format) {
  const { roots, I, B } = table(icons, brands);
  const body = [
    "// Generated by scripts/build.mjs — do not edit.",
    `const R = ${JSON.stringify(roots)};`,
    `const V = ${JSON.stringify(VARIANTS)};`,
    `const I = ${JSON.stringify(I)};`,
    `const B = ${JSON.stringify(B)};`,
    "const has = (o, k) => typeof k === \"string\" && Object.prototype.hasOwnProperty.call(o, k);",
    "function getIcon(name, variant = \"outline\") {",
    "  if (variant === \"brand\") {",
    "    if (!has(B, name)) throw new Error(`Unknown brand icon: ${name}`);",
    "    return R[B[name][0]] + B[name][1] + \"</svg>\";",
    "  }",
    "  const v = V.indexOf(variant);",
    "  if (v < 0) throw new Error(`Unknown icon variant: ${variant}`);",
    "  if (!has(I, name)) throw new Error(`Unknown icon: ${name}`);",
    "  return R[I[name][v * 2]] + I[name][v * 2 + 1] + \"</svg>\";",
    "}",
    format === "esm" ? "export { getIcon };" : "exports.getIcon = getIcon;",
  ];
  return body.join("\n") + "\n";
}

function dts(icons, brands) {
  const union = (o) => Object.keys(o).map((n) => JSON.stringify(n)).join(" | ") || "never";
  return [
    "// Generated by scripts/build.mjs — do not edit.",
    `export type IconName = ${union(icons)};`,
    `export type BrandName = ${union(brands)};`,
    `export type IconVariant = ${VARIANTS.map((v) => JSON.stringify(v)).join(" | ")};`,
    "/**",
    " * Returns the SVG markup for an icon. Colour follows `currentColor`;",
    " * size it with CSS or width/height on the element you insert it into.",
    " *",
    " * @example getIcon(\"user\")            // outline",
    " * @example getIcon(\"user\", \"solid\")",
    " * @example getIcon(\"github\", \"brand\")",
    " */",
    "export declare function getIcon(name: IconName, variant?: IconVariant): string;",
    "export declare function getIcon(name: BrandName, variant: \"brand\"): string;",
  ].join("\n") + "\n";
}

const icons = await load();
const tags = await loadTags(icons);
const brands = await loadBrands();
const brandTags = await loadTags(brands, `icons/${BRANDS}/tags.json`, "a brand");
const site = renderSite({ icons, tags, variants: VARIANTS, brands, brandTags });

if (errors.length) {
  console.error(`✖ ${errors.length} problem(s):\n  ` + errors.join("\n  "));
  process.exit(1);
}

const count = Object.keys(icons).length;
const brandCount = Object.keys(brands).length;
if (CHECK_ONLY) {
  console.log(`✔ ${count} icon(s) × ${VARIANTS.length} variants and ${brandCount} brand(s) valid`);
  process.exit(0);
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
const types = dts(icons, brands);
await Promise.all([
  writeFile(join(DIST, "index.js"), runtime(icons, brands, "esm")),
  writeFile(join(DIST, "index.cjs"), runtime(icons, brands, "cjs")),
  writeFile(join(DIST, "index.d.ts"), types),
  writeFile(join(DIST, "index.d.cts"), types),
]);
// The website: browser, llms.txt and per-icon endpoints.
await rm(SITE, { recursive: true, force: true });
await Promise.all([...VARIANTS, "brands"].map((d) => mkdir(join(SITE, d), { recursive: true })));
const files = [
  ["index.html", site],
  ["llms.txt", llmsTxt({ icons, tags, variants: VARIANTS, brands, brandTags })],
];
for (const [name, v] of Object.entries(icons)) {
  files.push([`${name}.svg`, v[VARIANTS[0]] + "\n"], [`${name}.md`, iconMarkdown(name, v, tags[name])], [`${name}.txt`, iconText(name, v, tags[name])]);
  for (const variant of VARIANTS) files.push([`${variant}/${name}.svg`, v[variant] + "\n"]);
}
for (const [name, svg] of Object.entries(brands)) {
  const v = { brand: svg }, opts = { brand: true };
  files.push([`brands/${name}.svg`, svg + "\n"], [`brands/${name}.md`, iconMarkdown(name, v, brandTags[name], opts)], [`brands/${name}.txt`, iconText(name, v, brandTags[name], opts)]);
}
await Promise.all(files.map(([f, body]) => writeFile(join(SITE, f), body)));
console.log(`✔ Built ${count} icon(s) × ${VARIANTS.length} variants and ${brandCount} brand(s) → dist/ and site/ (${files.length} files)`);
