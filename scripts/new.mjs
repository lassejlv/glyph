#!/usr/bin/env node
// Scaffolds a new icon in every variant: npm run new -- <icon-name>

import { writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2];

if (!name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  console.error("Usage: npm run new -- <icon-name>   (kebab-case, e.g. arrow-right)");
  process.exit(1);
}

const templates = {
  outline: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <!-- draw ${name} here -->
</svg>
`,
  // Same geometry as outline: fill + stroke gives an identical silhouette.
  // For pure line icons (plus, check…) use fill="none" stroke-width="2" instead.
  solid: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <!-- draw ${name} here -->
</svg>
`,
};

for (const [variant, svg] of Object.entries(templates)) {
  const file = join(ROOT, "icons", variant, `${name}.svg`);
  const exists = await access(file).then(() => true, () => false);
  if (exists) {
    console.log(`• icons/${variant}/${name}.svg already exists, skipped`);
    continue;
  }
  await writeFile(file, svg);
  console.log(`✔ Created icons/${variant}/${name}.svg`);
}
