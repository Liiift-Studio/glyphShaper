// glyphShaper/src/core/types.ts — path command types and options interface

/**
 * A moveto command — lifts the pen to an absolute position.
 * Begins a new sub-path.
 */
export interface CmdM { type: 'M'; x: number; y: number }

/**
 * A lineto command — draws a straight line from the current point.
 */
export interface CmdL { type: 'L'; x: number; y: number }

/**
 * A cubic Bézier command — draws a curve using two off-curve control handles.
 * (x1,y1) is the handle near the start; (x2,y2) is the handle near the endpoint.
 */
export interface CmdC { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }

/**
 * A quadratic Bézier command — draws a curve using one shared off-curve handle.
 */
export interface CmdQ { type: 'Q'; x1: number; y1: number; x: number; y: number }

/**
 * A closepath command — draws a straight line back to the start of the current sub-path.
 */
export interface CmdZ { type: 'Z' }

/** Union of all glyph path segment types produced by opentype.js */
export type PathCommand = CmdM | CmdL | CmdC | CmdQ | CmdZ

/** Options for the @font-face override rule injected by applyFontBlob */
export interface GlyphShaperOptions {
	/** CSS font-weight for the @font-face rule. Default: 'normal' */
	fontWeight?: string
	/** CSS font-style for the @font-face rule. Default: 'normal' */
	fontStyle?: string
}
