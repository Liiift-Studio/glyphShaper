// glyphShaper/src/core/forge.ts — font parsing, glyph extraction, and @font-face override

import type { Font as OpentypeFont } from 'opentype.js'
import type { PathCommand, GlyphShaperOptions } from './types'

// ─── Internal font handle ────────────────────────────────────────────────────

/**
 * Opaque wrapper around an opentype.js Font object.
 * Do not construct directly — use parseFont().
 */
export type GlyphFont = { _font: OpentypeFont }

// ─── WOFF2 decompression ──────────────────────────────────────────────────────

/** WOFF2 magic bytes: "wOF2" (0x774F4632) at byte offset 0 */
const WOFF2_MAGIC = 0x774f4632

/**
 * Return true if the buffer starts with the WOFF2 signature.
 * Does not validate the rest of the header.
 */
function isWoff2(buffer: ArrayBuffer): boolean {
	if (buffer.byteLength < 4) return false
	return new DataView(buffer).getUint32(0, false) === WOFF2_MAGIC
}

/**
 * Decompress a WOFF2 buffer to a raw OTF/TTF ArrayBuffer using wawoff2 (WASM brotli).
 * Dynamic import so the WASM module is only loaded when actually needed.
 */
async function decompressWoff2(buffer: ArrayBuffer): Promise<ArrayBuffer> {
	const { decompress } = await import('wawoff2')
	const result = await decompress(new Uint8Array(buffer))
	return result.buffer as ArrayBuffer
}

// ─── Parse ────────────────────────────────────────────────────────────────────

/**
 * Parse an ArrayBuffer into a GlyphFont handle.
 * Accepts TTF, OTF, WOFF1, and WOFF2 — WOFF2 is transparently decompressed
 * via wawoff2 (WASM brotli) before being passed to opentype.js.
 * Throws if the buffer is not a valid font.
 *
 * @param buffer - Raw font bytes from fetch().arrayBuffer() or FileReader
 */
export async function parseFont(buffer: ArrayBuffer): Promise<GlyphFont> {
	// Decompress WOFF2 before parsing — opentype.js requires uncompressed data
	const raw = isWoff2(buffer) ? await decompressWoff2(buffer) : buffer

	// Dynamic import keeps opentype.js out of the critical path and SSR-safe
	const { parse } = await import('opentype.js')
	const font = parse(raw)
	return { _font: font }
}

// ─── Glyph path access ────────────────────────────────────────────────────────

/**
 * Extract a deep copy of the path commands for the given character.
 * Returns an empty array if the character has no outlines (e.g., space).
 *
 * @param font - Parsed font handle
 * @param char - Single character to look up
 */
export function getGlyphCommands(font: GlyphFont, char: string): PathCommand[] {
	const idx = font._font.charToGlyphIndex(char)
	const glyph = font._font.glyphs.get(idx)
	if (!glyph?.path?.commands) return []
	// Deep-copy so the editor state is independent of the font's internal data
	return glyph.path.commands.map(cmd => ({ ...cmd }) as PathCommand)
}

/**
 * Write modified path commands back into the font's glyph.
 * This mutates the font object in place so the next call to fontToBlob()
 * regenerates with these commands applied.
 *
 * @param font     - Parsed font handle (mutated in place)
 * @param char     - Character whose glyph to update
 * @param commands - New path commands (from the editor)
 */
export function setGlyphCommands(font: GlyphFont, char: string, commands: PathCommand[]): void {
	const idx = font._font.charToGlyphIndex(char)
	const glyph = font._font.glyphs.get(idx)
	if (!glyph?.path) return
	// Cast: opentype.js path.commands accepts the same shape we define in PathCommand
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	glyph.path.commands = commands as any
}

// ─── Regenerate ───────────────────────────────────────────────────────────────

/**
 * Serialise the (possibly edited) font back to a Blob.
 * The Blob contains a valid OTF/TTF binary and can be used to create a Blob URL.
 *
 * @param font - Parsed (and optionally edited) font handle
 */
export function fontToBlob(font: GlyphFont): Blob {
	// toArrayBuffer() is a public method on opentype.js Font objects;
	// it is what font.download() calls internally
	const buffer = font._font.toArrayBuffer()
	return new Blob([buffer], { type: 'font/opentype' })
}

// ─── Apply override ───────────────────────────────────────────────────────────

/** Style element ID used for the injected @font-face override */
const STYLE_ID = 'glyphshaper-override'

/**
 * Inject a dynamic @font-face rule that overrides the named font family with
 * the provided Blob. All text on the page using fontFamily will re-render.
 *
 * If existingUrl is provided it will be revoked before creating the new one.
 * Returns the new Blob URL so the caller can revoke it later.
 *
 * @param fontFamily  - CSS font-family value to override
 * @param blob        - Font data blob from fontToBlob()
 * @param existingUrl - Previously active Blob URL to revoke (optional)
 * @param options     - font-weight / font-style for the @font-face rule
 */
export function applyFontBlob(
	fontFamily: string,
	blob: Blob,
	existingUrl?: string,
	options: GlyphShaperOptions = {},
): string {
	if (existingUrl) URL.revokeObjectURL(existingUrl)
	const url = URL.createObjectURL(blob)
	const weight = options.fontWeight ?? 'normal'
	const style  = options.fontStyle  ?? 'normal'

	// Remove any previous override rule
	document.getElementById(STYLE_ID)?.remove()

	const el = document.createElement('style')
	el.id = STYLE_ID
	el.textContent = [
		`@font-face {`,
		`  font-family: ${JSON.stringify(fontFamily)};`,
		`  src: url(${JSON.stringify(url)}) format('opentype');`,
		`  font-weight: ${weight};`,
		`  font-style: ${style};`,
		`}`,
	].join('\n')
	document.head.appendChild(el)
	return url
}

/**
 * Revoke a previously created Blob URL and remove the override style element.
 * Call this when the editor is unmounted or the font is replaced.
 *
 * @param url - Blob URL previously returned by applyFontBlob()
 */
export function revokeFont(url: string): void {
	URL.revokeObjectURL(url)
	document.getElementById(STYLE_ID)?.remove()
}

// ─── SVG path helpers ─────────────────────────────────────────────────────────

/**
 * Convert an array of PathCommands to an SVG path `d` attribute string.
 * Uses the glyph coordinate system (y-up) — apply a flip transform in SVG.
 *
 * @param commands - Path commands to serialise
 */
export function commandsToPathD(commands: PathCommand[]): string {
	return commands.map(cmd => {
		switch (cmd.type) {
			case 'M': return `M ${cmd.x} ${cmd.y}`
			case 'L': return `L ${cmd.x} ${cmd.y}`
			case 'C': return `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`
			case 'Q': return `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`
			case 'Z': return 'Z'
		}
	}).join(' ')
}
