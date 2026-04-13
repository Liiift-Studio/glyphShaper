// glyphForge/src/core/forge.ts — font parsing, glyph extraction, and @font-face override

import type { Font as OpentypeFont } from 'opentype.js'
import type { PathCommand, GlyphForgeOptions } from './types'

// ─── Internal font handle ────────────────────────────────────────────────────

/**
 * Opaque wrapper around an opentype.js Font object.
 * Do not construct directly — use parseFont().
 */
export type GlyphFont = { _font: OpentypeFont }

// ─── Parse ────────────────────────────────────────────────────────────────────

/**
 * Parse an ArrayBuffer containing a TTF or OTF font binary into a GlyphFont handle.
 * Throws if the buffer is not a valid font.
 *
 * @param buffer - Raw font bytes from fetch().arrayBuffer() or FileReader
 */
export async function parseFont(buffer: ArrayBuffer): Promise<GlyphFont> {
	// Dynamic import keeps opentype.js out of the critical path and SSR-safe
	const { parse } = await import('opentype.js')
	const font = parse(buffer)
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
const STYLE_ID = 'glyphforge-override'

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
	options: GlyphForgeOptions = {},
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
