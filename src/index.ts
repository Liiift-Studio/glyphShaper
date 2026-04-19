// glyphShaper/src/index.ts — public API exports

// Core types
export type { PathCommand, GlyphShaperOptions, CmdM, CmdL, CmdC, CmdQ, CmdZ } from './core/types'

// Core functions
export type { GlyphFont, Woff2Decompressor } from './core/forge'
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
export { GlyphShaperEditor, GlyphSvgEditor } from './react/GlyphShaperEditor'
export type { GlyphShaperEditorProps, GlyphSvgEditorProps } from './react/GlyphShaperEditor'
