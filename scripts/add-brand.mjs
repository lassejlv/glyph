#!/usr/bin/env node
// Adds a brand logo from a Simple Icons SVG, scaled to match the UI icons.
//
//   npm run brand -- <name> <path/to/simple-icons/icon.svg>
//
// Simple Icons fill the whole 24×24 box. Glyph's UI icons sit inside 3–21,
// so the path is scaled to 75% around the centre (x' = 0.75x + 3) and the
// result is written to icons/brands/<name>.svg.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCALE = 0.75;
const OFFSET = 12 * (1 - SCALE);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

const fmt = (v) => {
  const s = v.toFixed(3).replace(/\.?0+$/, "");
  return s === "-0" || s === "" ? "0" : s;
};

/** Scales path data uniformly about the centre of the 24×24 box. */
export function scalePath(d, scale = SCALE, offset = OFFSET) {
  let i = 0;
  let cmd = null;
  let first = true;
  const out = [];
  const skip = () => {
    while (i < d.length && " ,\t\n\r".includes(d[i])) i++;
  };
  const num = () => {
    skip();
    NUM.lastIndex = i;
    const m = NUM.exec(d);
    if (!m) throw new Error(`Expected a number at position ${i} in path data`);
    i = NUM.lastIndex;
    return Number(m[0]);
  };
  const flag = () => {
    // Arc flags may be packed without separators, e.g. "a1 1 0 011 1".
    skip();
    return d[i++];
  };

  while (true) {
    skip();
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) {
      cmd = d[i++];
      out.push(cmd);
      if (cmd === "Z" || cmd === "z") continue;
    } else if (!cmd) {
      throw new Error("Path data must start with a command");
    } else {
      out.push(" ");
      if (cmd === "M") cmd = "L"; // extra pairs after a moveto are linetos
      if (cmd === "m") cmd = "l";
    }
    const upper = cmd.toUpperCase();
    // A path's first moveto is absolute even when written as "m".
    const rel = cmd !== upper && !(first && cmd === "m");
    first = false;
    const map = (v) => (rel ? v * scale : v * scale + offset);

    if (upper === "A") {
      const rx = num(), ry = num(), rot = num();
      const large = flag(), sweep = flag();
      const x = num(), y = num();
      out.push([fmt(rx * scale), fmt(ry * scale), fmt(rot), large, sweep, fmt(map(x)), fmt(map(y))].join(" "));
    } else {
      const values = Array.from({ length: ARITY[upper] }, num);
      out.push(values.map((v) => fmt(map(v))).join(" "));
    }
  }
  return out.join("").replace(/ -/g, "-");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [name, source] = process.argv.slice(2);
  if (!name || !source || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    console.error("Usage: npm run brand -- <name> <path/to/simple-icons/icon.svg>   (kebab-case name, starting with a letter)");
    process.exit(1);
  }
  const svg = await readFile(source, "utf8");
  const paths = [...svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length !== 1) {
    console.error(`Expected exactly one <path> in ${source}, found ${paths.length}`);
    process.exit(1);
  }
  const file = join(ROOT, "icons", "brands", `${name}.svg`);
  await writeFile(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">\n  <path d="${scalePath(paths[0])}"/>\n</svg>\n`,
  );
  console.log(`✔ Wrote icons/brands/${name}.svg — add keywords to icons/brands/tags.json, then run npm run build`);
}
