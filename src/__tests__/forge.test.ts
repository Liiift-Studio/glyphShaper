// glyphShaper/src/__tests__/forge.test.ts — unit tests for core forge functions

import { describe, it, expect } from 'vitest'
import {
	commandsToPathD,
	getGlyphCommands,
	setGlyphCommands,
} from '../core/forge'
import type { GlyphFont } from '../core/forge'
import type { PathCommand } from '../core/types'

// ─── Mock font ─────────────────────────────────────────────────────────────────

/** Minimal glyph path for a made-up character */
const MOCK_COMMANDS: PathCommand[] = [
	{ type: 'M', x: 10,  y: 0   },
	{ type: 'L', x: 100, y: 0   },
	{ type: 'C', x1: 110, y1: 0, x2: 120, y2: 50, x: 120, y: 100 },
	{ type: 'Q', x1: 120, y1: 150, x: 60, y: 150 },
	{ type: 'Z' },
]

/** Create a minimal GlyphFont mock whose single glyph has MOCK_COMMANDS.
 *  glyphs.get() always returns the SAME glyph object so mutations via
 *  setGlyphCommands are visible to subsequent reads. */
function makeMockFont(commands: PathCommand[] = MOCK_COMMANDS): GlyphFont {
	// Single shared glyph instance — mutations are visible across calls
	const glyph = {
		path: { commands: commands.map(c => ({ ...c })) as PathCommand[] },
		leftSideBearing: 0,
		advanceWidth: 500,
	}
	return {
		_font: {
			charToGlyphIndex: (_char: string) => 65,
			glyphs: { get: (_idx: number) => glyph },
		} as unknown as GlyphFont['_font'],
	}
}

// ─── commandsToPathD ──────────────────────────────────────────────────────────

describe('commandsToPathD', () => {
	it('produces correct M command', () => {
		expect(commandsToPathD([{ type: 'M', x: 10, y: 20 }])).toBe('M 10 20')
	})

	it('produces correct L command', () => {
		expect(commandsToPathD([{ type: 'L', x: 50, y: 75 }])).toBe('L 50 75')
	})

	it('produces correct C command', () => {
		expect(commandsToPathD([
			{ type: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 },
		])).toBe('C 1 2 3 4 5 6')
	})

	it('produces correct Q command', () => {
		expect(commandsToPathD([
			{ type: 'Q', x1: 10, y1: 20, x: 30, y: 40 },
		])).toBe('Q 10 20 30 40')
	})

	it('produces correct Z command', () => {
		expect(commandsToPathD([{ type: 'Z' }])).toBe('Z')
	})

	it('joins multiple commands with spaces', () => {
		const cmds: PathCommand[] = [
			{ type: 'M', x: 0, y: 0 },
			{ type: 'L', x: 100, y: 0 },
			{ type: 'Z' },
		]
		expect(commandsToPathD(cmds)).toBe('M 0 0 L 100 0 Z')
	})

	it('returns empty string for empty array', () => {
		expect(commandsToPathD([])).toBe('')
	})

	it('round-trips the full MOCK_COMMANDS sequence', () => {
		const d = commandsToPathD(MOCK_COMMANDS)
		expect(d).toBe('M 10 0 L 100 0 C 110 0 120 50 120 100 Q 120 150 60 150 Z')
	})
})

// ─── getGlyphCommands ─────────────────────────────────────────────────────────

describe('getGlyphCommands', () => {
	it('returns a deep copy of the glyph path commands', () => {
		const font = makeMockFont()
		const cmds = getGlyphCommands(font, 'A')
		expect(cmds).toHaveLength(MOCK_COMMANDS.length)
		expect(cmds[0]).toEqual(MOCK_COMMANDS[0])
	})

	it('returns a copy — mutating the result does not affect subsequent calls', () => {
		const font = makeMockFont()
		const cmds = getGlyphCommands(font, 'A')
		// Mutate the returned copy
		;(cmds[0] as { type: 'M'; x: number; y: number }).x = 999
		// A second call should return the original (unmodified) mock values
		const cmds2 = getGlyphCommands(font, 'A')
		expect((cmds2[0] as { type: 'M'; x: number; y: number }).x).toBe(10)
	})

	it('returns an empty array for a glyph with no path', () => {
		const emptyFont: GlyphFont = {
			_font: {
				charToGlyphIndex: () => 0,
				glyphs: {
					get: () => ({ path: null }),
				},
			} as unknown as GlyphFont['_font'],
		}
		expect(getGlyphCommands(emptyFont, ' ')).toEqual([])
	})
})

// ─── setGlyphCommands ─────────────────────────────────────────────────────────

describe('setGlyphCommands', () => {
	it('replaces the glyph path commands in place', () => {
		const newCmds: PathCommand[] = [
			{ type: 'M', x: 0, y: 0 },
			{ type: 'L', x: 200, y: 200 },
			{ type: 'Z' },
		]
		const font = makeMockFont()
		// Grab a reference to the internal glyph object to inspect after mutation
		const glyph = font._font.glyphs.get(65)
		setGlyphCommands(font, 'A', newCmds)
		expect(glyph!.path!.commands).toEqual(newCmds)
	})

	it('is a no-op when the glyph has no path', () => {
		const font: GlyphFont = {
			_font: {
				charToGlyphIndex: () => 0,
				glyphs: { get: () => ({ path: null }) },
			} as unknown as GlyphFont['_font'],
		}
		// Should not throw
		expect(() => setGlyphCommands(font, ' ', [])).not.toThrow()
	})

	it('round-trips through getGlyphCommands', () => {
		const font = makeMockFont()
		const edited: PathCommand[] = [
			{ type: 'M', x: 5, y: 5 },
			{ type: 'Z' },
		]
		setGlyphCommands(font, 'A', edited)
		const result = getGlyphCommands(font, 'A')
		expect(result).toEqual(edited)
	})

	it('updates advanceWidth and leftSideBearing when path extent changes', () => {
		// MOCK_COMMANDS: xMin=10, xMax=120, advanceWidth=500 → RSB=380
		const font = makeMockFont()
		const glyph = font._font.glyphs.get(65)!
		// Wider path: xMin=20, xMax=200
		setGlyphCommands(font, 'A', [
			{ type: 'M', x: 20, y: 0 },
			{ type: 'L', x: 200, y: 100 },
			{ type: 'Z' },
		])
		// advanceWidth = new xMax (200) + original RSB (500-120=380) = 580
		expect(glyph.advanceWidth).toBe(580)
		expect(glyph.leftSideBearing).toBe(20)
	})
})
