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
 * A function that decompresses a WOFF2 ArrayBuffer to a raw OTF/TTF ArrayBuffer.
 * Pass one to parseFont() when handling WOFF2 input — the library does not bundle
 * a decompressor itself to stay browser-safe.
 *
 * Example using wawoff2 in a Node.js / server context:
 * ```ts
 * import { decompress } from 'wawoff2'
 * const decompressor: Woff2Decompressor = async (buf) => {
 *   const result = await decompress(new Uint8Array(buf))
 *   return result.buffer as ArrayBuffer
 * }
 * ```
 *
 * Example using a fetch-based proxy (browser-safe):
 * ```ts
 * const decompressor: Woff2Decompressor = async (buf) => {
 *   const res = await fetch('/api/decompress-woff2', { method: 'POST', body: buf })
 *   return res.arrayBuffer()
 * }
 * ```
 */
export type Woff2Decompressor = (woff2Buffer: ArrayBuffer) => Promise<ArrayBuffer>

// ─── Parse ────────────────────────────────────────────────────────────────────

/**
 * Parse an ArrayBuffer into a GlyphFont handle.
 * Accepts TTF, OTF, and WOFF1 natively. For WOFF2 input, provide a
 * woff2Decompressor — the library does not bundle one to stay browser-safe.
 * Throws if the buffer is not a valid font.
 *
 * @param buffer           - Raw font bytes from fetch().arrayBuffer() or FileReader
 * @param woff2Decompressor - Optional decompressor for WOFF2 input (see Woff2Decompressor type)
 */
export async function parseFont(buffer: ArrayBuffer, woff2Decompressor?: Woff2Decompressor): Promise<GlyphFont> {
	let raw = buffer
	if (isWoff2(buffer)) {
		if (!woff2Decompressor) {
			throw new Error(
				'[glyphshaper] WOFF2 input requires a woff2Decompressor. ' +
				'Pass one to parseFont(), or convert the font to TTF / OTF / WOFF first.'
			)
		}
		raw = await woff2Decompressor(buffer)
	}

	// Dynamic import keeps opentype.js out of the critical path and SSR-safe
	const { parse } = await import('opentype.js')
	let font
	try {
		font = parse(raw)
	} catch (err) {
		if (err instanceof Error && /not yet supported|lookup type/i.test(err.message)) {
			throw new Error(
				'This font uses an OpenType feature not yet supported by opentype.js ' +
				`(${err.message}). Try a different font — Inter, Roboto, and most system fonts work well.`
			)
		}
		throw err
	}

	// GSUB (glyph substitution) and GPOS (glyph positioning) tables use features
	// that opentype.js 1.x cannot re-serialise (e.g. lookup type 6 format 2).
	// We only need raw path commands for glyph editing, so drop these tables before
	// they cause toArrayBuffer() to throw. The browser handles shaping on its own.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const t = (font as any).tables
	delete t.gsub
	delete t.gpos
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	;(font as any).substitution = null
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	;(font as any).position = null

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
/** Return the xMin and xMax of a set of path commands using all on/off-curve x coordinates. */
function pathXBounds(cmds: PathCommand[]): { xMin: number; xMax: number } | null {
	let xMin = Infinity, xMax = -Infinity
	for (const cmd of cmds) {
		if (cmd.type === 'Z') continue
		const xs = cmd.type === 'C' ? [cmd.x1, cmd.x2, cmd.x] :
		           cmd.type === 'Q' ? [cmd.x1, cmd.x] :
		           [cmd.x]
		for (const x of xs) { if (x < xMin) xMin = x; if (x > xMax) xMax = x }
	}
	return xMin === Infinity ? null : { xMin, xMax }
}

export function setGlyphCommands(font: GlyphFont, char: string, commands: PathCommand[]): void {
	const idx = font._font.charToGlyphIndex(char)
	const glyph = font._font.glyphs.get(idx)
	if (!glyph?.path) return

	// Preserve the right-side bearing (whitespace cushion after the ink) before mutating the path.
	// advanceWidth = path xMax + RSB, so RSB = advanceWidth - xMax.
	const oldBounds = pathXBounds(glyph.path.commands as PathCommand[])
	const rsb = oldBounds !== null ? (glyph.advanceWidth ?? 0) - oldBounds.xMax : 0

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	glyph.path.commands = commands as any

	// Update hmtx metrics to match the new path extent.
	// LSB tracks the new left edge; advanceWidth = new right edge + original RSB.
	if (glyph.advanceWidth !== undefined) {
		const newBounds = pathXBounds(commands)
		if (newBounds !== null) {
			glyph.leftSideBearing = Math.round(newBounds.xMin)
			glyph.advanceWidth = Math.max(0, Math.round(newBounds.xMax + rsb))
		}
	}
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
