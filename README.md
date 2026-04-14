# Glyph Shaper

CSS and JavaScript have no native way to reshape individual glyph outlines after the font loads. `glyphShaper` parses the font binary in the browser, lets you drag bezier control points to edit any character's outline, then regenerates the font and injects a `@font-face` override — every instance of that character on the page re-renders instantly, no page reload required.

**[glyphshaper.com](https://glyphshaper.com)** · [npm](https://www.npmjs.com/package/@liiift-studio/glyphshaper) · [GitHub](https://github.com/Liiift-Studio/glyphShaper)

TypeScript · React · Requires `opentype.js` + `wawoff2`

---

## Install

```bash
npm install @liiift-studio/glyphshaper opentype.js wawoff2
```

`opentype.js` and `wawoff2` are required peer dependencies — they handle font parsing and WOFF2 decompression respectively and must be installed alongside this package.

---

## Usage

> **Next.js App Router:** this library uses browser APIs. Add `"use client"` to any component file that imports from it.

> **Font format:** `glyphShaper` accepts TTF, OTF, WOFF1, and WOFF2. The font must be loaded from a URL accessible to `fetch()` (or supplied as a `File` object via `<input type="file">`).

### React component

The `GlyphShaperEditor` component handles font loading, character palette, the SVG bezier editor, undo history, and the apply-to-page step in one self-contained component.

```tsx
'use client'
import { useGlyphFont, GlyphShaperEditor } from '@liiift-studio/glyphshaper'

export default function MyPage() {
  const { font } = useGlyphFont('/fonts/MyFont.ttf')

  return (
    <GlyphShaperEditor font={font} fontFamily="MyFont" text="Headline">
      <h1 style={{ fontFamily: 'MyFont' }}>Headline</h1>
    </GlyphShaperEditor>
  )
}
```

The `fontFamily` prop must match the CSS `font-family` value already applied to your page text — this is what the `@font-face` override targets.

### React hook — font loading only

Use `useGlyphFont` alone when you want to drive the lower-level functions directly.

```tsx
'use client'
import { useGlyphFont, getGlyphCommands, setGlyphCommands, fontToBlob, applyFontBlob } from '@liiift-studio/glyphshaper'

export default function MyEditor() {
  const { font, loading, error } = useGlyphFont('/fonts/MyFont.ttf')

  if (loading) return <p>Loading…</p>
  if (error)   return <p>Error: {error}</p>
  if (!font)   return null

  const cmds = getGlyphCommands(font, 'A')
  // … modify cmds …
  setGlyphCommands(font, 'A', cmds)
  const blob = fontToBlob(font)
  applyFontBlob('MyFont', blob)
}
```

### Vanilla JS

```ts
import { parseFont, getGlyphCommands, setGlyphCommands, fontToBlob, applyFontBlob } from '@liiift-studio/glyphshaper'

const res    = await fetch('/fonts/MyFont.ttf')
const buffer = await res.arrayBuffer()
const font   = await parseFont(buffer)

// Read glyph outline commands for 'A'
const cmds = getGlyphCommands(font, 'A')

// Modify commands (e.g. shift the first anchor point)
const modified = cmds.map((cmd, i) =>
  i === 0 && cmd.type === 'M' ? { ...cmd, x: cmd.x + 20 } : cmd
)

// Write back and inject override
setGlyphCommands(font, 'A', modified)
const blob = fontToBlob(font)
applyFontBlob('MyFont', blob)
```

### TypeScript

```ts
import type { GlyphFont, PathCommand, GlyphShaperOptions, CmdM, CmdL, CmdC, CmdQ, CmdZ } from '@liiift-studio/glyphshaper'

const opts: GlyphShaperOptions = {
  fontWeight: 'bold',
  fontStyle: 'normal',
}
```

---

## API

### `useGlyphFont(source)`

React hook. Fetches and parses a font from a URL string or `File` object. Returns `{ font, loading, error }`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | `string \| File \| null` | Font URL, user-uploaded `File`, or `null` to reset |

### `parseFont(buffer)`

Async. Parses an `ArrayBuffer` (TTF, OTF, WOFF1, or WOFF2) into a `GlyphFont` handle. WOFF2 is transparently decompressed via wawoff2 before being handed to opentype.js.

### `getGlyphCommands(font, char)`

Returns a deep copy of the path commands for `char` as a `PathCommand[]`. Returns `[]` for characters with no outlines (e.g., space).

### `setGlyphCommands(font, char, commands)`

Writes modified commands back into the font object in place. The change takes effect on the next `fontToBlob()` call.

### `fontToBlob(font)`

Serialises the (possibly modified) font back to an `ArrayBuffer` using opentype.js's download path.

### `applyFontBlob(fontFamily, blob, previousUrl?)`

Injects a `@font-face` override rule targeting `fontFamily` with the supplied blob. Creates a Blob URL, appends a `<style>` tag to the document, and returns the Blob URL so it can be revoked later. If `previousUrl` is supplied it is revoked before the new rule is injected.

### `revokeFont(url)`

Revokes a Blob URL returned by `applyFontBlob` and removes the corresponding `<style>` tag from the document.

### `commandsToPathD(commands)`

Converts a `PathCommand[]` to an SVG `d` string suitable for use in a `<path>` element.

---

## `GlyphShaperEditor` props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `font` | `GlyphFont \| null` | — | Parsed font from `useGlyphFont()` or `parseFont()`. Pass `null` while loading |
| `fontFamily` | `string` | — | CSS font-family name the `@font-face` override will target |
| `text` | `string` | `'Typography'` | Text used to derive the character palette. Unique printable characters appear as clickable tiles |
| `children` | `ReactNode` | — | Content rendered with the font applied. If omitted, `text` is rendered as a paragraph |

---

## How it works

**Font parsing:** `parseFont()` uses dynamic `import('opentype.js')` so the parser is only loaded when called. WOFF2 fonts are first decompressed with `import('wawoff2')` (WASM brotli decoder), then passed to opentype.js as raw bytes.

**Path command model:** opentype.js exposes each glyph's outline as a flat array of path commands (`M`, `L`, `C`, `Q`, `Z`). `glyphShaper` deep-copies this array into React state so edits are non-destructive until the user clicks "Apply".

**SVG editor:** The inline bezier editor renders the glyph outline in a fixed-coordinate SVG (`viewBox 0 0 360 360`). A `y-flip` transform reconciles glyph space (y-up) with SVG space (y-down). Pointer capture keeps drags active when the cursor leaves a control point circle. `getScreenCTM().inverse()` converts pointer events at any CSS scale back to viewBox coordinates.

**Undo:** Each drag operation pushes a pre-drag snapshot of the commands array onto a bounded history stack (max 50 entries). Undo restores the last snapshot. `Ctrl+Z` / `Cmd+Z` is handled via a `keydown` listener while the editor panel is open.

**Font-face override:** After "Apply", `setGlyphCommands` writes the modified path back into the live opentype.js font object, `fontToBlob()` re-serialises the entire font to an `ArrayBuffer`, and `applyFontBlob()` creates a Blob URL and injects a `@font-face` rule at a higher specificity than the original. Every instance of the character on the page re-renders immediately without a reload.

---

## Peer dependencies

Both peer dependencies are **required** (not optional):

| Package | Purpose |
|---------|---------|
| `opentype.js` | Font parsing, glyph path access, and font serialisation |
| `wawoff2` | WOFF2 decompression (WASM brotli) — only loaded when a WOFF2 font is used |

If you are bundling for the browser and your bundler tries to resolve Node.js built-ins (`fs`, `path`) pulled in by `wawoff2`, stub them as empty modules. For webpack / Next.js:

```js
// next.config.ts / webpack config
config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false }
```

---

Current version: v1.0.5
