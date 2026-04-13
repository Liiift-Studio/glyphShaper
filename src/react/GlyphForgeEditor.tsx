// glyphForge/src/react/GlyphForgeEditor.tsx — interactive glyph bezier editor component

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { PathCommand } from '../core/types'
import type { GlyphFont } from '../core/forge'
import { getGlyphCommands, setGlyphCommands, fontToBlob, applyFontBlob, commandsToPathD } from '../core/forge'

// ─── SVG coordinate constants ──────────────────────────────────────────────────

/**
 * The internal SVG viewBox size in coordinate units.
 * The SVG renders at whatever CSS width its container provides — this value only
 * defines the internal coordinate system used for path drawing and control points.
 */
const VIEWBOX = 360
/** Padding inside the viewBox around the glyph */
const PADDING = 32
/** Radius of anchor (on-curve) control point circles, in viewBox units */
const ANCHOR_R = 7
/** Radius of handle (off-curve) control point circles, in viewBox units */
const HANDLE_R = 5
/** Maximum undo history depth */
const MAX_HISTORY = 50

// ─── Drag point ───────────────────────────────────────────────────────────────

/** A single draggable control point in the SVG editor */
interface DragPoint {
	/** Index into the commands array */
	cmdIdx: number
	/** Which coordinate fields this point controls */
	field: 'xy' | 'x1y1' | 'x2y2'
	/** Whether this is an on-curve anchor or off-curve bezier handle */
	kind: 'anchor' | 'handle'
	/** Current x position in glyph coordinate space */
	x: number
	/** Current y position in glyph coordinate space */
	y: number
}

/** Handle line connecting an off-curve handle to its on-curve anchor */
interface HandleLine {
	x1: number; y1: number
	x2: number; y2: number
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/**
 * Convert glyph coordinates to SVG viewBox coordinates.
 * Glyph space: y-up, origin at baseline-left.
 * SVG space: y-down, origin at top-left.
 */
function toSVG(gx: number, gy: number, scale: number, lsb: number, ascender: number): [number, number] {
	return [
		PADDING + (gx - lsb) * scale,
		PADDING + (ascender - gy) * scale,
	]
}

/**
 * Convert SVG viewBox coordinates back to glyph coordinates.
 * The SVG scales via CSS (width: 100%) but getScreenCTM().inverse() accounts
 * for that — pointer events always arrive in client coordinates regardless of
 * CSS scale, and the matrix transform converts them to viewBox coordinates.
 */
function toGlyph(svgX: number, svgY: number, scale: number, lsb: number, ascender: number): [number, number] {
	return [
		(svgX - PADDING) / scale + lsb,
		ascender - (svgY - PADDING) / scale,
	]
}

// ─── Path analysis ────────────────────────────────────────────────────────────

/**
 * Build a flat list of draggable control points from the command array.
 * Each command contributes one anchor (on-curve endpoint) plus zero, one, or
 * two off-curve handles depending on command type.
 */
function buildDragPoints(commands: PathCommand[]): DragPoint[] {
	const pts: DragPoint[] = []
	for (let i = 0; i < commands.length; i++) {
		const cmd = commands[i]
		if (cmd.type === 'M' || cmd.type === 'L') {
			pts.push({ cmdIdx: i, field: 'xy', kind: 'anchor', x: cmd.x, y: cmd.y })
		} else if (cmd.type === 'C') {
			pts.push({ cmdIdx: i, field: 'x1y1', kind: 'handle', x: cmd.x1, y: cmd.y1 })
			pts.push({ cmdIdx: i, field: 'x2y2', kind: 'handle', x: cmd.x2, y: cmd.y2 })
			pts.push({ cmdIdx: i, field: 'xy',   kind: 'anchor', x: cmd.x,  y: cmd.y  })
		} else if (cmd.type === 'Q') {
			pts.push({ cmdIdx: i, field: 'x1y1', kind: 'handle', x: cmd.x1, y: cmd.y1 })
			pts.push({ cmdIdx: i, field: 'xy',   kind: 'anchor', x: cmd.x,  y: cmd.y  })
		}
		// Z has no points
	}
	return pts
}

/**
 * Build lines that visually connect each off-curve handle to its adjacent anchors.
 */
function buildHandleLines(commands: PathCommand[]): HandleLine[] {
	const lines: HandleLine[] = []
	let prevX = 0
	let prevY = 0
	for (const cmd of commands) {
		if (cmd.type === 'M' || cmd.type === 'L') {
			prevX = cmd.x; prevY = cmd.y
		} else if (cmd.type === 'C') {
			lines.push({ x1: prevX, y1: prevY, x2: cmd.x1, y2: cmd.y1 })
			lines.push({ x1: cmd.x2, y1: cmd.y2, x2: cmd.x, y2: cmd.y })
			prevX = cmd.x; prevY = cmd.y
		} else if (cmd.type === 'Q') {
			lines.push({ x1: prevX, y1: prevY, x2: cmd.x1, y2: cmd.y1 })
			lines.push({ x1: cmd.x1, y1: cmd.y1, x2: cmd.x, y2: cmd.y })
			prevX = cmd.x; prevY = cmd.y
		}
	}
	return lines
}

/**
 * Return a new commands array with one control point moved to (newX, newY).
 * Rounds to integers to keep font unit values clean.
 */
function movePoint(
	commands: PathCommand[],
	cmdIdx: number,
	field: 'xy' | 'x1y1' | 'x2y2',
	newX: number,
	newY: number,
): PathCommand[] {
	const rx = Math.round(newX)
	const ry = Math.round(newY)
	return commands.map((cmd, i) => {
		if (i !== cmdIdx) return cmd
		if (field === 'xy' && (cmd.type === 'M' || cmd.type === 'L'))   return { ...cmd, x: rx, y: ry }
		if (field === 'xy' && (cmd.type === 'C' || cmd.type === 'Q'))   return { ...cmd, x: rx, y: ry }
		if (field === 'x1y1' && (cmd.type === 'C' || cmd.type === 'Q')) return { ...cmd, x1: rx, y1: ry }
		if (field === 'x2y2' && cmd.type === 'C')                        return { ...cmd, x2: rx, y2: ry }
		return cmd
	})
}

/** Collect unique printable characters from a string, preserving first-seen order. */
function uniquePrintableChars(text: string): string[] {
	const seen = new Set<string>()
	return text.split('').filter(c => {
		if (!c.trim() || seen.has(c)) return false
		seen.add(c)
		return true
	})
}

// ─── SVG glyph editor ─────────────────────────────────────────────────────────

/**
 * Interactive SVG panel showing the glyph outline with draggable bezier control
 * points.
 *
 * - Renders at `width: 100%` — fills whatever container it is placed in.
 * - `viewBox` stays fixed at VIEWBOX × VIEWBOX; `getScreenCTM().inverse()`
 *   ensures pointer → glyph coordinate conversion is correct at any CSS scale.
 * - Pointer capture keeps drag active when cursor leaves the circle.
 * - `onDragStart` fires once per drag (on pointerdown) so the parent can
 *   snapshot the current commands for undo before any movement happens.
 */
function GlyphSvgEditor({
	commands,
	font,
	char,
	onChange,
	onDragStart,
}: {
	commands: PathCommand[]
	font: GlyphFont
	char: string
	onChange: (commands: PathCommand[]) => void
	/** Called with the pre-drag snapshot when a drag starts — used for undo */
	onDragStart: (snapshot: PathCommand[]) => void
}) {
	const svgRef = useRef<SVGSVGElement>(null)
	const dragging = useRef<{ cmdIdx: number; field: 'xy' | 'x1y1' | 'x2y2' } | null>(null)

	// Compute scale so the glyph fills the available viewBox area
	const f        = font._font
	const glyphIdx = f.charToGlyphIndex(char)
	const glyph    = f.glyphs.get(glyphIdx)
	const lsb      = glyph?.leftSideBearing ?? 0
	const advance  = glyph?.advanceWidth   ?? f.unitsPerEm
	const ascender  = f.ascender
	const descender = f.descender
	const glyphW = advance
	const glyphH = ascender - descender
	const available = VIEWBOX - 2 * PADDING
	const scale = Math.min(available / glyphW, available / glyphH)

	const baselineY = PADDING + ascender * scale

	/** Convert a pointer event's client coordinates to glyph coordinates.
	 *  Uses getScreenCTM().inverse() so CSS scaling (width: 100%) is accounted for. */
	const ptrToGlyph = useCallback((e: React.PointerEvent): [number, number] => {
		const svg = svgRef.current
		if (!svg) return [0, 0]
		const pt = svg.createSVGPoint()
		pt.x = e.clientX
		pt.y = e.clientY
		const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
		return toGlyph(svgPt.x, svgPt.y, scale, lsb, ascender)
	}, [scale, lsb, ascender])

	function handlePointerDown(
		e: React.PointerEvent<SVGCircleElement>,
		cmdIdx: number,
		field: 'xy' | 'x1y1' | 'x2y2',
	) {
		e.stopPropagation()
		;(e.target as SVGCircleElement).setPointerCapture(e.pointerId)
		// Snapshot current commands BEFORE the drag — this is one undo step
		onDragStart(commands)
		dragging.current = { cmdIdx, field }
	}

	function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
		if (!dragging.current) return
		const [gx, gy] = ptrToGlyph(e)
		onChange(movePoint(commands, dragging.current.cmdIdx, dragging.current.field, gx, gy))
	}

	function handlePointerUp() {
		dragging.current = null
	}

	const pathD      = commandsToPathD(commands)
	const dragPoints = buildDragPoints(commands)
	const handleLns  = buildHandleLines(commands)

	return (
		<svg
			ref={svgRef}
			width="100%"
			viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerLeave={handlePointerUp}
			style={{
				display: 'block',
				touchAction: 'none',
				cursor: 'default',
				// Maintain a 1:1 aspect ratio as width scales with the container
				aspectRatio: '1 / 1',
			}}
			aria-label={`Glyph path editor for character ${char}`}
		>
			{/* Baseline guide */}
			<line
				x1={PADDING / 2} y1={baselineY}
				x2={VIEWBOX - PADDING / 2} y2={baselineY}
				stroke="rgba(255,255,255,0.08)" strokeWidth={1}
			/>

			{/* Advance-width guide */}
			{(() => {
				const [ax] = toSVG(advance, 0, scale, lsb, ascender)
				return (
					<line
						x1={ax} y1={PADDING / 2}
						x2={ax} y2={VIEWBOX - PADDING / 2}
						stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 4"
					/>
				)
			})()}

			{/* Glyph path in glyph coordinate space via a y-flipping transform */}
			<g transform={`translate(${PADDING + (0 - lsb) * scale}, ${PADDING + ascender * scale}) scale(${scale}, ${-scale})`}>
				{commands.length > 0 && (
					<path
						d={pathD}
						fill="rgba(212,184,240,0.12)"
						stroke="rgba(212,184,240,0.55)"
						strokeWidth={2 / scale}
						fillRule="nonzero"
					/>
				)}
			</g>

			{/* Handle guide lines */}
			{handleLns.map((ln, i) => {
				const [x1s, y1s] = toSVG(ln.x1, ln.y1, scale, lsb, ascender)
				const [x2s, y2s] = toSVG(ln.x2, ln.y2, scale, lsb, ascender)
				return (
					<line
						key={i}
						x1={x1s} y1={y1s} x2={x2s} y2={y2s}
						stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 3"
					/>
				)
			})}

			{/* Draggable control points */}
			{dragPoints.map((pt, i) => {
				const [cx, cy] = toSVG(pt.x, pt.y, scale, lsb, ascender)
				const r = pt.kind === 'anchor' ? ANCHOR_R : HANDLE_R
				return (
					<circle
						key={i}
						cx={cx} cy={cy} r={r}
						fill={pt.kind === 'anchor' ? 'rgba(212,184,240,0.9)' : 'rgba(0,0,0,0)'}
						stroke="rgba(212,184,240,0.75)"
						strokeWidth={1.5}
						style={{ cursor: 'grab' }}
						onPointerDown={(e) => handlePointerDown(e, pt.cmdIdx, pt.field)}
					/>
				)
			})}

			{commands.length === 0 && (
				<text
					x={VIEWBOX / 2} y={VIEWBOX / 2}
					textAnchor="middle"
					fill="rgba(255,255,255,0.3)"
					fontSize={12}
					fontFamily="sans-serif"
				>
					No outlines for this character
				</text>
			)}
		</svg>
	)
}

// ─── Main exported component ──────────────────────────────────────────────────

/** Props for GlyphForgeEditor */
export interface GlyphForgeEditorProps {
	/**
	 * Parsed font from useGlyphFont() or parseFont().
	 * Pass null while the font is loading to render a disabled state.
	 */
	font: GlyphFont | null
	/**
	 * CSS font-family name that the @font-face override will target.
	 * Must match the font-family already applied to your page text.
	 */
	fontFamily: string
	/**
	 * Text used to derive the character palette.
	 * Unique printable characters from this string appear as clickable tiles.
	 * Default: 'Typography'
	 */
	text?: string
	/**
	 * Content rendered with the (possibly overridden) font applied.
	 * If omitted, `text` is rendered as a paragraph.
	 */
	children?: React.ReactNode
}

/**
 * All-in-one glyph path editor.
 *
 * Renders the provided children with fontFamily applied, a palette of unique
 * characters from `text`, and an inline SVG bezier editor that opens when a
 * character is selected. Clicking "Apply" regenerates the font binary and
 * injects a new @font-face override — every instance of that character on the
 * page re-renders immediately.
 *
 * Each drag operation is one undo step. Undo is available via the button or
 * Ctrl/Cmd+Z while the editor is open.
 *
 * @example
 * const { font } = useGlyphFont('/fonts/MyFont.ttf')
 * <GlyphForgeEditor font={font} fontFamily="MyFont" text="Heading">
 *   <h1 style={{ fontFamily: 'MyFont' }}>Heading</h1>
 * </GlyphForgeEditor>
 */
export function GlyphForgeEditor({
	font,
	fontFamily,
	text = 'Typography',
	children,
}: GlyphForgeEditorProps) {
	const [editingChar, setEditingChar] = useState<string | null>(null)
	const [commands, setCommands]       = useState<PathCommand[]>([])
	/** Undo history — each entry is a pre-drag snapshot of the commands array */
	const [history, setHistory]         = useState<PathCommand[][]>([])
	/** Most-recently applied Blob URL — kept so we can revoke it on next apply */
	const appliedUrlRef = useRef<string | null>(null)

	const chars   = uniquePrintableChars(text)
	const canUndo = history.length > 0

	// ─── Undo ──────────────────────────────────────────────────────────────────

	function handleUndo() {
		if (history.length === 0) return
		const prev = history[history.length - 1]
		setHistory(h => h.slice(0, -1))
		setCommands(prev)
	}

	/** Snapshot commands before each drag so every drag is one undo step. */
	function handleDragStart(snapshot: PathCommand[]) {
		setHistory(h => {
			const next = [...h, snapshot]
			// Cap history depth to avoid unbounded memory growth
			return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
		})
	}

	// ─── Keyboard shortcut ─────────────────────────────────────────────────────

	// Keep a stable ref to the latest handleUndo so the effect doesn't need to
	// re-bind on every history change
	const undoRef = useRef(handleUndo)
	useEffect(() => { undoRef.current = handleUndo })

	useEffect(() => {
		if (!editingChar) return
		function onKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
				e.preventDefault()
				undoRef.current()
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [editingChar])

	// ─── Editor lifecycle ───────────────────────────────────────────────────────

	function openChar(char: string) {
		if (!font) return
		setCommands(getGlyphCommands(font, char))
		setEditingChar(char)
		setHistory([])
	}

	function handleCancel() {
		setEditingChar(null)
		setCommands([])
		setHistory([])
	}

	function handleApply() {
		if (!font || !editingChar) return
		setGlyphCommands(font, editingChar, commands)
		const blob = fontToBlob(font)
		const url  = applyFontBlob(fontFamily, blob, appliedUrlRef.current ?? undefined)
		appliedUrlRef.current = url
		setEditingChar(null)
		setCommands([])
		setHistory([])
	}

	// ─── Render ────────────────────────────────────────────────────────────────

	return (
		<div>
			{/* Rendered text preview */}
			<div style={{ fontFamily }}>
				{children ?? <p>{text}</p>}
			</div>

			{/* Character palette */}
			{font && (
				<div
					role="group"
					aria-label="Character palette — click to edit"
					style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '16px' }}
				>
					{chars.map(char => (
						<button
							key={char}
							onClick={() => openChar(char)}
							aria-pressed={editingChar === char}
							style={{
								width: 32,
								height: 32,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontFamily,
								fontSize: 16,
								border: '1px solid rgba(255,255,255,0.2)',
								borderRadius: 4,
								background: editingChar === char ? 'rgba(212,184,240,0.15)' : 'transparent',
								cursor: 'pointer',
								color: 'inherit',
								transition: 'background 0.15s',
							}}
						>
							{char}
						</button>
					))}
				</div>
			)}

			{/* Inline bezier editor */}
			{editingChar && font && (
				<div
					style={{
						marginTop: 16,
						padding: 16,
						border: '1px solid rgba(255,255,255,0.12)',
						borderRadius: 8,
					}}
				>
					<p style={{ fontSize: 11, opacity: 0.5, marginBottom: 12, fontFamily: 'sans-serif' }}>
						Editing &ldquo;{editingChar}&rdquo; — drag filled circles (anchors) or outlined circles (handles) to reshape
					</p>

					<GlyphSvgEditor
						commands={commands}
						font={font}
						char={editingChar}
						onChange={setCommands}
						onDragStart={handleDragStart}
					/>

					<div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
						<button
							onClick={handleCancel}
							style={{
								fontSize: 12,
								padding: '4px 12px',
								borderRadius: 20,
								border: '1px solid rgba(255,255,255,0.3)',
								background: 'transparent',
								color: 'inherit',
								opacity: 0.6,
								cursor: 'pointer',
							}}
						>
							Cancel
						</button>

						<button
							onClick={handleUndo}
							disabled={!canUndo}
							title="Undo last drag (Ctrl+Z / Cmd+Z)"
							style={{
								fontSize: 12,
								padding: '4px 12px',
								borderRadius: 20,
								border: '1px solid rgba(255,255,255,0.3)',
								background: 'transparent',
								color: 'inherit',
								opacity: canUndo ? 0.7 : 0.25,
								cursor: canUndo ? 'pointer' : 'default',
								transition: 'opacity 0.15s',
							}}
						>
							Undo
						</button>

						<button
							onClick={handleApply}
							style={{
								fontSize: 12,
								padding: '4px 12px',
								borderRadius: 20,
								border: '1px solid rgba(212,184,240,0.7)',
								background: 'rgba(212,184,240,0.1)',
								color: 'inherit',
								cursor: 'pointer',
								marginLeft: 'auto',
							}}
						>
							Apply to page
						</button>
					</div>
				</div>
			)}

			{!font && (
				<p style={{ marginTop: 12, fontSize: 12, opacity: 0.4, fontFamily: 'sans-serif' }}>
					No font loaded.
				</p>
			)}
		</div>
	)
}
