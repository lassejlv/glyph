# Glyph

1000+ clean, consistent SVG icons in two styles, **outline** and **solid**, plus a small set of brand logos. They're published on npm as [`glyph-icons`](https://www.npmjs.com/package/glyph-icons).

```bash
npm install glyph-icons
```

```ts
import { getIcon } from "glyph-icons";

el.innerHTML = getIcon("user");             // outline (default)
el.innerHTML = getIcon("user", "solid");
el.innerHTML = getIcon("github", "brand");  // brand logos
```

`getIcon` is the package's only export. It is fully typed:

- `name` autocompletes every icon.
- `"brand"` only accepts brand names.
- A typo is a compile error.

At runtime an unknown name throws.

## Browse the icons

Open `index.html` in a browser, or serve the repo with GitHub Pages. You can search by name or keyword, switch between outline and solid, change the preview size, and click an icon to copy its SVG or download it. Press `/` to jump to the search box.

## Using the icons

`getIcon(name, variant?)` returns a plain SVG string. The icons inherit their colour from `currentColor`, so they take on the surrounding text colour. The string has no `width`/`height`, so size the icon with CSS:

```css
.icon svg { width: 20px; height: 20px; }
```

The types `IconName`, `BrandName` and `IconVariant` are exported for your own props, for example `function Icon({ name }: { name: IconName })`.

The package works with both `import` and `require`.

All icons sit in one lookup table, so bundling `getIcon` includes the whole set: about 0.5 MB, or about 90 KB gzipped. The raw SVG files are also in `icons/` in this repo.

## Project layout

```
icons/
  outline/<name>.svg   source icons, 1.5px stroke
  solid/<name>.svg     source icons, filled
  tags.json            search keywords per icon
scripts/
  build.mjs            validates icons, generates the package (dist/) and index.html
  site.mjs             the icon browser page template
  new.mjs              scaffolds a new icon in every variant
index.html             generated icon browser (committed)
dist/                  the npm package, generated (git-ignored)
  index.js, index.cjs, index.d.ts, index.d.cts
```

## Adding an icon

```bash
npm run new -- arrow-right
```

This creates `icons/outline/arrow-right.svg` and `icons/solid/arrow-right.svg` from templates. Draw the shapes, add search keywords to `icons/tags.json` (optional), then run:

```bash
npm run build
```

This regenerates `dist/` and `index.html`. Commit `index.html` together with the new icon.

`npm run check` validates the icons without building. It fails when:

- an icon is missing from one of the variants
- the `viewBox` is not `0 0 24 24`, or the `<svg>` has `width`/`height`
- a `fill` or `stroke` is a hard-coded color instead of `currentColor` or `none`
- the file contains `style`, `class` or `id` attributes, or no shapes
- the file name is not kebab-case
- `icons/tags.json` names an icon that doesn't exist
- `index.html` is out of date

## Brand icons

Logos for common tools and providers (GitHub, Discord, Claude, Figma, …) live in `icons/brands/<name>.svg`. They come in a single style, filled with `currentColor`, and are scaled to sit in the same 3–21 area as the UI icons, so the two collections line up at the same size. Get them with the `"brand"` variant: `getIcon("github", "brand")`. The raw files are in `icons/brands/`.

**Adding a brand.** Take the logo from [Simple Icons](https://simpleicons.org) rather than drawing it, so the mark stays accurate. Download its SVG and run:

```bash
npm run brand -- <name> path/to/simple-icons-logo.svg
```

This scales the path to 75% around the centre (Simple Icons fill the whole 24×24 box) and writes `icons/brands/<name>.svg`. Add search keywords to `icons/brands/tags.json` (optional, e.g. `"x": ["twitter"]`), then run `npm run build`. Brands follow the same checks as the UI icons, except that there are no variants.

The brand path data comes from [Simple Icons](https://github.com/simple-icons/simple-icons) and is licensed CC0. The logos themselves are trademarks of their respective owners. Follow each owner's brand guidelines when you use them.

## Design guidelines

Following these rules keeps new icons consistent with the existing ones.

- **Grid:** 24×24, with content inside a 2px safe area (x/y between 2 and 22).
- **Outline:** `stroke-width="1.5"`, round caps and joins, `fill="none"`. Put coordinates on 0.25 increments.
- **Solid, shapes:** reuse the outline geometry with `fill="currentColor"` *and* the same 1.5 round stroke. The silhouette then matches the outline exactly, with the same rounded corners. Details such as the slots in `trash` or the V in `mail` are cut-outs (`fill-rule="evenodd"`). Because the stroke also runs along a cut-out's edge, draw each cut-out 0.75 larger on every side than it should appear.
- **Solid, line icons** (`plus`, `check`, `arrow-right` and similar): use the same paths as the outline with `stroke-width="2"`.
- **Corners:** soften them. Round joins handle sharp vertices; give rectangles a radius of 1.5–2.25.
- **Optical size:** filled shapes such as `star` and `heart` should span about the same area as rectangular ones (roughly 3–21 including the stroke).
- **Detail:** both variants should read clearly at 16px.

## Publishing

Release from your machine, on an up-to-date `main` with no uncommitted changes:

```bash
npm login
```

```bash
npm run release
```

`npm run release` takes an optional bump:

- `npm run release` (no argument) releases a patch, e.g. 0.1.0 → 0.1.1.
- `minor`, `major` or an exact version: `npm run release -- minor`, `npm run release -- 1.2.3`.
- `--dry-run` shows what would happen and changes nothing.

The release script:

1. Checks you're logged in to npm and on a clean, up-to-date `main`.
2. Builds and validates the icons.
3. Bumps the version with a `Release vX.Y.Z` commit and tag.
4. Publishes to npm.
5. Pushes the commit and tag to GitHub.

If publishing fails, the version commit and tag are undone, so you can fix the problem and run it again. Only `dist/`, README, LICENSE and package.json go into the package.

## Adding a variant

To add another style (for example `mini`), create `icons/mini/`, add `"mini"` to `VARIANTS` in `scripts/build.mjs`, and add a template for it in `scripts/new.mjs`.
