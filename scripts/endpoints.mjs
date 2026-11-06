// Text endpoints for the site: llms.txt and one .md / .txt per icon and brand.
// Links are relative, so the site works at a domain root or under a subpath
// (e.g. a project page under /glyph/).

export const PACKAGE = "glyph-svg";
export const REPO = "https://github.com/lassejlv/glyph";

const fence = (lang, body) => "```" + lang + "\n" + body + "\n```";

/** Markdown page for one icon (variants: { outline, solid }) or brand (variants: { brand }). */
export function iconMarkdown(name, variants, tags = [], { brand = false } = {}) {
  const kind = brand ? "brand logo" : "icon";
  const usage = brand
    ? `getIcon(${JSON.stringify(name)}, "brand");`
    : Object.keys(variants)
        .map((v, i) => (i === 0 ? `getIcon(${JSON.stringify(name)});${" ".repeat(Math.max(1, 12 - name.length))}// ${v} (default)` : `getIcon(${JSON.stringify(name)}, ${JSON.stringify(v)});`))
        .join("\n");
  const files = brand
    ? [`[${name}.svg](${name}.svg)`]
    : [`[${name}.svg](${name}.svg) (outline)`, ...Object.keys(variants).map((v) => `[${v}/${name}.svg](${v}/${name}.svg)`)];
  return [
    `# ${name}`,
    "",
    `${brand ? "Brand logo" : "Icon"} from Glyph, published on npm as \`${PACKAGE}\`. The SVG uses \`currentColor\` and a 24×24 viewBox, with no width or height, so you size it with CSS.`,
    ...(tags.length ? ["", `Keywords: ${tags.join(", ")}`] : []),
    ...(brand ? ["", "The logo is a trademark of its owner. Path data from Simple Icons (CC0)."] : []),
    "",
    "## Usage",
    "",
    fence("ts", `import { getIcon } from "${PACKAGE}";\n\n${usage}`),
    "",
    ...Object.entries(variants).flatMap(([v, svg]) => [`## ${brand ? "SVG" : v[0].toUpperCase() + v.slice(1)}`, "", fence("svg", svg), ""]),
    "## Files",
    "",
    ...files.map((f) => `- ${f}`),
    "",
    `This ${kind} is part of Glyph. Index: [llms.txt](${brand ? "../" : ""}llms.txt).`,
    "",
  ].join("\n");
}

/** Plain-text page for one icon or brand. */
export function iconText(name, variants, tags = [], { brand = false } = {}) {
  const usage = brand
    ? `getIcon(${JSON.stringify(name)}, "brand")`
    : Object.keys(variants).map((v, i) => (i === 0 ? `getIcon(${JSON.stringify(name)})` : `getIcon(${JSON.stringify(name)}, ${JSON.stringify(v)})`)).join("  or  ");
  return [
    name,
    `${brand ? "Brand logo" : "Icon"} from Glyph (npm: ${PACKAGE})`,
    ...(tags.length ? [`Keywords: ${tags.join(", ")}`] : []),
    `Usage: import { getIcon } from "${PACKAGE}"; ${usage}`,
    "",
    ...Object.entries(variants).flatMap(([v, svg]) => [brand ? "SVG:" : `${v[0].toUpperCase() + v.slice(1)} SVG:`, svg, ""]),
  ].join("\n");
}

/** llms.txt (https://llmstxt.org): what Glyph is, how to use it, and an index of every icon. */
export function llmsTxt({ icons, tags, variants, brands, brandTags }) {
  const iconCount = Object.keys(icons).length;
  const brandCount = Object.keys(brands).length;
  const line = (href, name, kw) => `- [${name}](${href})${kw?.length ? `: ${kw.join(", ")}` : ""}`;
  return [
    "# Glyph",
    "",
    `> ${iconCount} SVG icons in ${variants.join(" and ")} styles, plus ${brandCount} brand logos. Published on npm as \`${PACKAGE}\` with a single type-safe function: \`getIcon(name, variant?)\`.`,
    "",
    "## Usage",
    "",
    fence("bash", `npm install ${PACKAGE}`),
    "",
    fence("ts", `import { getIcon } from "${PACKAGE}";\n\ngetIcon("user");             // outline (default)\ngetIcon("user", "solid");    // solid\ngetIcon("github", "brand");  // brand logo`),
    "",
    "Facts for using the package correctly:",
    "",
    `- \`getIcon\` is the only export. It returns an SVG string. The types \`IconName\`, \`BrandName\` and \`IconVariant\` are also exported.`,
    `- Variants are ${variants.map((v) => `\`"${v}"\``).join(" and ")} (the default is \`"${variants[0]}"\`). Brand logos use \`"brand"\` and only accept brand names.`,
    "- An unknown name or variant is a TypeScript error and throws at runtime.",
    "- Icons use `currentColor` and a `0 0 24 24` viewBox with no width or height. Set the colour with CSS `color` and the size with CSS width/height on the `svg` element.",
    "- Icon names are kebab-case, for example `arrow-right`, `chevron-down`, `file-plus`, `user-check` and `x-mark`.",
    "- Each icon has `<name>.svg` (the outline), `outline/<name>.svg`, `solid/<name>.svg`, `<name>.md` and `<name>.txt` next to this file. Brand logos are under `brands/`.",
    "",
    "## Docs",
    "",
    `- [README](${REPO}#readme): installation, usage and the design guidelines`,
    `- [npm package](https://www.npmjs.com/package/${PACKAGE})`,
    "- [Icon browser](index.html): search and preview every icon",
    "",
    "## Icons",
    "",
    ...Object.keys(icons).map((n) => line(`${n}.md`, n, tags[n])),
    "",
    "## Brands",
    "",
    ...Object.keys(brands).map((n) => line(`brands/${n}.md`, n, brandTags[n])),
    "",
  ].join("\n");
}
