# Glyph

Clean, consistent SVG icons in two styles: **outline** and **solid**.

## Browse the icons

Open `index.html` in a browser, or serve the repo with GitHub Pages. You can search by name or keyword, switch between outline and solid, change the preview size, and click an icon to copy its SVG or download it. Press `/` to jump to the search box.

## Using the icons

Every icon is a plain SVG that inherits its color from `currentColor`, so it takes on the surrounding text color. Set the size with CSS or `width`/`height`.

**Raw files.** Copy them from `icons/outline/` or `icons/solid/`.

**JavaScript / TypeScript** (after `npm run build`):

```js
import { userOutline, userSolid, getIcon } from "glyph";

el.innerHTML = userOutline;
el.innerHTML = getIcon("user", "solid"); // typed: IconName, IconVariant
```

**Sprite.** One request covers every icon:

```html
<svg width="24" height="24"><use href="dist/sprite/outline.svg#user" /></svg>
```

## Project layout

```
icons/
  outline/<name>.svg   source icons, 1.5px stroke
  solid/<name>.svg     source icons, filled
  tags.json            search keywords per icon
scripts/
  build.mjs            validates icons, generates dist/ and index.html
  site.mjs             the icon browser page template
  new.mjs              scaffolds a new icon in every variant
index.html             generated icon browser (committed)
dist/                  generated (git-ignored)
  index.js, index.d.ts, icons.json, sprite/<variant>.svg
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

Logos for common tools and providers (GitHub, Discord, Claude, Figma, …) live in `icons/brands/<name>.svg`. They come in a single style, filled with `currentColor`, and use the full 24×24 box. They are a separate collection from the UI icons:

```js
import { githubBrand, getBrand, brands } from "glyph";

el.innerHTML = githubBrand;
el.innerHTML = getBrand("x"); // typed: BrandName
```

```html
<svg width="24" height="24"><use href="dist/sprite/brands.svg#github" /></svg>
```

The build also writes `dist/brands.json`. The raw files are in `icons/brands/`.

**Adding a brand.** Take the logo from [Simple Icons](https://simpleicons.org) rather than drawing it, so the mark stays accurate. Save its path data as `icons/brands/<name>.svg` with this wrapper, without `<title>`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="…"/>
</svg>
```

Add search keywords to `icons/brands/tags.json` (optional, e.g. `"x": ["twitter"]`), then run `npm run build`. Brands follow the same checks as the UI icons, except that there are no variants. The name must also start with a letter, because it becomes the `<name>Brand` export.

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

## Adding a variant

To add another style (for example `mini`), create `icons/mini/`, add `"mini"` to `VARIANTS` in `scripts/build.mjs`, and add a template for it in `scripts/new.mjs`.
