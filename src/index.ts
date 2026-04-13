// glyphShaper/src/index.ts — public API exports

// Core types
export type { PathCommand, GlyphShaperOptions, CmdM, CmdL, CmdC, CmdQ, CmdZ } from './core/types'

// Core functions
export type { GlyphFont } from './core/forge'
export {
	parseFont,
	getGlyphCommands,
	setGlyphCommands,
	fontToBlob,
	applyFontBlob,
	revokeFont,
	commandsToPathD,
} from './core/forge'

// React
export { useGlyphFont } from './react/useGlyphFont'
export { GlyphShaperEditor } from './react/GlyphForgeEditor'
