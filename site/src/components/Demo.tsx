"use client"

// Interactive demo — loads Inter by default; file upload replaces it
import { useState, useRef, useCallback, useEffect } from "react"
import {
	parseFont, applyFontBlob, fontToBlob,
	getGlyphCommands, setGlyphCommands,
	GlyphSvgEditor,
} from "@liiift-studio/glyphshaper"
import type { GlyphFont, PathCommand } from "@liiift-studio/glyphshaper"

/** CSS font-family name used for the demo override rule */
const DEMO_FAMILY = "GlyphShaperDemo"

/** Accepted font file extensions */
const ACCEPT = ".ttf,.otf,.woff,.woff2"

/** URL of the default font bundled with the site */
const DEFAULT_FONT_URL = "/fonts/inter-300.woff"

/** Display name shown in the upload zone for the default font */
const DEFAULT_FONT_NAME = "Inter"

/** Two editorial paragraphs shown in the demo */
const PARA_1 = "Every typeface carries the fingerprints of its maker — the exact weight a stroke achieves before it stops, the angle at which a curve resolves, the precise distance between letters that lets the eye rest. These decisions accumulate invisibly. A good font is one where the reader never notices the design, only the words."
const PARA_2 = "Sphinx of black quartz, judge my vow. The quick brown fox jumps over the lazy dog, and somewhere in that familiar sentence, the full alphabet completes itself. Five boxing wizards jump quickly; pack my box with five dozen liquor jugs."

/** Every unique character across both paragraphs — snapshotted at parse time */
const ALL_DEMO_TEXT = PARA_1 + PARA_2

/** Server-side WOFF2 decompressor — keeps wawoff2 out of the browser bundle */
async function decompressWoff2(buffer: ArrayBuffer): Promise<ArrayBuffer> {
	const res = await fetch("/api/decompress-woff2", { method: "POST", body: buffer })
	if (!res.ok) throw new Error(`WOFF2 decompression failed (${res.status})`)
	return res.arrayBuffer()
}

/** Loading stages shown in the progress bar */
const LOAD_STAGES = ["Fetching font", "Parsing glyphs", "Applying to page"] as const
type LoadStage = typeof LOAD_STAGES[number] | null

// ─── Adjustments ─────────────────────────────────────────────────────────────

type Adjustments = {
	width: number      // horizontal scale (%) around glyph centre
	leftSide: number   // extra scale for left-half points (%)
	rightSide: number  // extra scale for right-half points (%)
	shoulders: number  // scale Bézier handle offsets from their anchors (%)
}

const ADJ_ZERO: Adjustments = { width: 0, leftSide: 0, rightSide: 0, shoulders: 0 }

type GlyphSnapshot = { cmds: PathCommand[]; cx: number }

function computeCx(cmds: PathCommand[]): number {
	let minX = Infinity, maxX = -Infinity
	for (const cmd of cmds) {
		if ("x"  in cmd) { if (cmd.x  < minX) minX = cmd.x;  if (cmd.x  > maxX) maxX = cmd.x  }
		if ("x1" in cmd) { if (cmd.x1 < minX) minX = cmd.x1; if (cmd.x1 > maxX) maxX = cmd.x1 }
		if ("x2" in cmd) { if (cmd.x2 < minX) minX = cmd.x2; if (cmd.x2 > maxX) maxX = cmd.x2 }
	}
	return minX === Infinity ? 0 : (minX + maxX) / 2
}

function combineAdj(g: Adjustments, c: Adjustments): Adjustments {
	return { width: g.width + c.width, leftSide: g.leftSide + c.leftSide, rightSide: g.rightSide + c.rightSide, shoulders: g.shoulders + c.shoulders }
}

function isZeroAdj(a: Adjustments): boolean {
	return a.width === 0 && a.leftSide === 0 && a.rightSide === 0 && a.shoulders === 0
}

function adjX(x: number, cx: number, width: number, leftSide: number, rightSide: number): number {
	let nx = cx + (x - cx) * (1 + width / 100)
	const d = nx - cx
	if      (d < 0) nx = cx + d * (1 + leftSide  / 100)
	else if (d > 0) nx = cx + d * (1 + rightSide / 100)
	return nx
}

function applyTransform(cmds: PathCommand[], cx: number, adj: Adjustments): PathCommand[] {
	const { width, leftSide, rightSide, shoulders } = adj
	const tx = (x: number) => adjX(x, cx, width, leftSide, rightSide)
	let px = 0, py = 0
	return cmds.map(cmd => {
		if (cmd.type === "Z") return { type: "Z" }
		if (cmd.type === "M") { const nx = tx(cmd.x); px = nx; py = cmd.y; return { type: "M", x: nx, y: cmd.y } }
		if (cmd.type === "L") { const nx = tx(cmd.x); px = nx; py = cmd.y; return { type: "L", x: nx, y: cmd.y } }
		if (cmd.type === "Q") {
			const nx  = tx(cmd.x)
			const nx1 = px + (tx(cmd.x1) - px) * (1 + shoulders / 100)
			const ny1 = py + (cmd.y1 - py)     * (1 + shoulders / 100)
			px = nx; py = cmd.y
			return { type: "Q", x1: nx1, y1: ny1, x: nx, y: cmd.y }
		}
		if (cmd.type === "C") {
			const nx  = tx(cmd.x)
			const nx1 = px + (tx(cmd.x1) - px) * (1 + shoulders / 100)
			const ny1 = py + (cmd.y1 - py)     * (1 + shoulders / 100)
			const nx2 = nx + (tx(cmd.x2) - nx) * (1 + shoulders / 100)
			const ny2 = cmd.y + (cmd.y2 - cmd.y) * (1 + shoulders / 100)
			px = nx; py = cmd.y
			return { type: "C", x1: nx1, y1: ny1, x2: nx2, y2: ny2, x: nx, y: cmd.y }
		}
		return cmd as PathCommand
	})
}

// ─── Slider sub-component ────────────────────────────────────────────────────

function AdjSlider({ label, value, min, max, onChange }: {
	label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between items-baseline">
				<label className="text-xs opacity-50">{label}</label>
				<span className="text-xs opacity-30 font-mono tabular-nums" style={{ minWidth: "2.5rem", textAlign: "right" }}>
					{value > 0 ? `+${value}` : value}
				</span>
			</div>
			<input type="range" min={min} max={max} step={1} value={value} aria-label={label}
				onChange={e => onChange(Number(e.target.value))} className="w-full" />
		</div>
	)
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const TOOLTIP_W = 308

function getTooltipStyle(anchor: DOMRect, tooltipH: number): React.CSSProperties {
	const gap = 10
	const midX   = anchor.left + anchor.width / 2
	const left   = Math.max(8, Math.min(midX - TOOLTIP_W / 2, window.innerWidth - TOOLTIP_W - 8))
	// Prefer above; flip below if not enough room
	const spaceAbove = anchor.top - gap
	if (spaceAbove >= Math.min(tooltipH, 120)) {
		return { position: "fixed", left, bottom: window.innerHeight - anchor.top + gap, width: TOOLTIP_W, zIndex: 200 }
	}
	return { position: "fixed", left, top: anchor.bottom + gap, width: TOOLTIP_W, zIndex: 200 }
}

function Tooltip({
	char, anchor, font,
	charAdj, onCharAdjChange, onResetCharAdj,
	bezierCmds, onBezierChange, onBezierDragStart,
	bezierHistory, onBezierUndo, onBezierApply, onBezierCancel,
	onClose,
}: {
	char: string
	anchor: DOMRect
	font: GlyphFont
	charAdj: Adjustments
	onCharAdjChange: (key: keyof Adjustments, value: number) => void
	onResetCharAdj: () => void
	bezierCmds: PathCommand[]
	onBezierChange: (cmds: PathCommand[]) => void
	onBezierDragStart: (snapshot: PathCommand[]) => void
	bezierHistory: PathCommand[][]
	onBezierUndo: () => void
	onBezierApply: () => void
	onBezierCancel: () => void
	onClose: () => void
}) {
	const [tab, setTab] = useState<"adjust" | "path">("adjust")
	const tooltipRef = useRef<HTMLDivElement>(null)
	const [tooltipH, setTooltipH] = useState(260)

	useEffect(() => {
		if (tooltipRef.current) setTooltipH(tooltipRef.current.offsetHeight)
	})

	// Cmd+Z / Ctrl+Z in path tab
	useEffect(() => {
		if (tab !== "path") return
		const histRef = { current: bezierHistory }
		histRef.current = bezierHistory
		function onKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
				e.preventDefault()
				onBezierUndo()
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [tab, bezierHistory, onBezierUndo])

	const canUndo = bezierHistory.length > 0
	const style = getTooltipStyle(anchor, tooltipH)

	return (
		<div
			ref={tooltipRef}
			style={{
				...style,
				background: "rgba(12,12,14,0.97)",
				border: "1px solid rgba(255,255,255,0.1)",
				borderRadius: 10,
				boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			{/* Header */}
			<div style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "10px 14px",
				borderBottom: "1px solid rgba(255,255,255,0.07)",
			}}>
				<span style={{ fontFamily: DEMO_FAMILY, fontSize: 18, lineHeight: 1, color: "rgba(212,184,240,1)", minWidth: 20 }}>
					{char}
				</span>
				<div style={{ display: "flex", gap: 4, flex: 1 }}>
					{(["adjust", "path"] as const).map(t => (
						<button
							key={t}
							onClick={() => setTab(t)}
							style={{
								fontSize: 11,
								padding: "3px 10px",
								borderRadius: 20,
								border: "1px solid rgba(255,255,255,0.2)",
								background: tab === t ? "rgba(212,184,240,0.12)" : "transparent",
								color: tab === t ? "rgba(212,184,240,1)" : "rgba(255,255,255,0.4)",
								cursor: "pointer",
								transition: "background 0.12s, color 0.12s",
								textTransform: "capitalize",
							}}
						>
							{t}
						</button>
					))}
				</div>
				<button
					onClick={onClose}
					aria-label="Close"
					style={{
						fontSize: 16,
						lineHeight: 1,
						opacity: 0.35,
						cursor: "pointer",
						background: "transparent",
						border: "none",
						color: "inherit",
						padding: "2px 4px",
					}}
				>
					×
				</button>
			</div>

			{/* Adjust tab */}
			{tab === "adjust" && (
				<div style={{ padding: "14px 14px 12px" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
						<AdjSlider label="Width"           value={charAdj.width}     min={-50} max={100} onChange={v => onCharAdjChange("width",     v)} />
						<AdjSlider label="Shoulders"       value={charAdj.shoulders} min={-80} max={100} onChange={v => onCharAdjChange("shoulders", v)} />
						<AdjSlider label="Left thickness"  value={charAdj.leftSide}  min={-50} max={100} onChange={v => onCharAdjChange("leftSide",  v)} />
						<AdjSlider label="Right thickness" value={charAdj.rightSide} min={-50} max={100} onChange={v => onCharAdjChange("rightSide", v)} />
					</div>
					<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
						<button onClick={onResetCharAdj} style={{ fontSize: 11, opacity: 0.35, cursor: "pointer", background: "transparent", border: "none", color: "inherit" }}>
							Reset
						</button>
					</div>
				</div>
			)}

			{/* Path tab */}
			{tab === "path" && (
				<div>
					<div style={{ padding: "6px 10px 0" }}>
						<p style={{ fontSize: 10, opacity: 0.35, fontFamily: "sans-serif" }}>
							Drag filled circles (anchors) or outlined (handles) to reshape
						</p>
					</div>
					<GlyphSvgEditor
						commands={bezierCmds}
						font={font}
						char={char}
						onChange={onBezierChange}
						onDragStart={onBezierDragStart}
					/>
					<div style={{
						display: "flex",
						gap: 6,
						padding: "8px 10px 10px",
						borderTop: "1px solid rgba(255,255,255,0.07)",
					}}>
						<button onClick={onBezierCancel} style={btnStyle(false)}>Cancel</button>
						<button onClick={onBezierUndo} disabled={!canUndo} style={btnStyle(false, !canUndo)}>Undo</button>
						<button onClick={onBezierApply} style={{ ...btnStyle(true), marginLeft: "auto" }}>Apply to page</button>
					</div>
				</div>
			)}
		</div>
	)
}

function btnStyle(primary: boolean, disabled = false): React.CSSProperties {
	return {
		fontSize: 11,
		padding: "4px 10px",
		borderRadius: 20,
		border: primary ? "1px solid rgba(212,184,240,0.6)" : "1px solid rgba(255,255,255,0.2)",
		background: primary ? "rgba(212,184,240,0.1)" : "transparent",
		color: "inherit",
		opacity: disabled ? 0.25 : 0.8,
		cursor: disabled ? "default" : "pointer",
		transition: "opacity 0.12s",
	}
}

// ─── Clickable text ───────────────────────────────────────────────────────────

function ClickableText({ text, selectedChar, onSelect, style }: {
	text: string
	selectedChar: string | null
	onSelect: (ch: string | null, rect: DOMRect) => void
	style?: React.CSSProperties
}) {
	return (
		<span style={style}>
			{text.split("").map((ch, i) => {
				if (ch === " ") return <span key={i}>{" "}</span>
				const isSelected = selectedChar === ch
				return (
					<span
						key={i}
						role="button"
						tabIndex={0}
						aria-label={`Select character ${ch}`}
						aria-pressed={isSelected}
						onClick={e => {
							const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
							onSelect(isSelected ? null : ch, rect)
						}}
						onKeyDown={e => {
							if (e.key === "Enter") {
								const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
								onSelect(isSelected ? null : ch, rect)
							}
						}}
						style={{
							cursor: "pointer",
							borderBottom: isSelected ? "1px solid rgba(212,184,240,0.7)" : "1px solid transparent",
							color: isSelected ? "rgba(212,184,240,1)" : "inherit",
							transition: "color 0.1s, border-color 0.1s",
						}}
					>
						{ch}
					</span>
				)
			})}
		</span>
	)
}

// ─── Demo ─────────────────────────────────────────────────────────────────────

export default function Demo() {
	const [font, setFont]           = useState<GlyphFont | null>(null)
	const [fileName, setFileName]   = useState<string>("")
	const [loading, setLoading]     = useState(false)
	const [loadStage, setLoadStage] = useState<LoadStage>(null)
	const [loadPct, setLoadPct]     = useState(0)
	const [error, setError]         = useState<string | null>(null)

	// Selection
	const [selectedChar, setSelectedChar]     = useState<string | null>(null)
	const [anchorRect, setAnchorRect]         = useState<DOMRect | null>(null)

	// Global adjustments
	const [globalAdj, setGlobalAdj] = useState<Adjustments>(ADJ_ZERO)
	// Per-character adjustments
	const [charAdjs, setCharAdjs]   = useState<Map<string, Adjustments>>(new Map())

	// Bezier editor state (managed here to avoid font-blob conflicts with GlyphShaperEditor)
	const [bezierCmds, setBezierCmds]         = useState<PathCommand[]>([])
	const [bezierHistory, setBezierHistory]   = useState<PathCommand[][]>([])

	const blobUrlRef  = useRef<string | null>(null)
	const origCmdsRef = useRef<Map<string, GlyphSnapshot>>(new Map())
	const adjTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Load bezier commands from snapshot whenever selection changes
	useEffect(() => {
		if (!selectedChar) { setBezierCmds([]); setBezierHistory([]); return }
		const snap = origCmdsRef.current.get(selectedChar)
		setBezierCmds(snap ? snap.cmds.map(c => ({ ...c }) as PathCommand) : (font ? getGlyphCommands(font, selectedChar) : []))
		setBezierHistory([])
	}, [selectedChar, font])

	function snapshotFont(f: GlyphFont) {
		const snap = new Map<string, GlyphSnapshot>()
		const seen = new Set<string>()
		for (const ch of ALL_DEMO_TEXT) {
			if (seen.has(ch) || ch === " ") continue
			seen.add(ch)
			const cmds = getGlyphCommands(f, ch)
			if (!cmds.length) continue
			snap.set(ch, { cmds, cx: computeCx(cmds) })
		}
		origCmdsRef.current = snap
	}

	function applyAdjs(f: GlyphFont, gAdj: Adjustments, cAdjs: Map<string, Adjustments>) {
		for (const [ch, { cmds, cx }] of origCmdsRef.current) {
			const cAdj = cAdjs.get(ch) ?? ADJ_ZERO
			const eff  = combineAdj(gAdj, cAdj)
			setGlyphCommands(f, ch, isZeroAdj(eff) ? cmds.map(c => ({ ...c }) as PathCommand) : applyTransform(cmds, cx, eff))
		}
		const blob = fontToBlob(f)
		const url  = applyFontBlob(DEMO_FAMILY, blob, blobUrlRef.current ?? undefined)
		blobUrlRef.current = url
	}

	function scheduleApply(f: GlyphFont, gAdj: Adjustments, cAdjs: Map<string, Adjustments>) {
		if (adjTimerRef.current) clearTimeout(adjTimerRef.current)
		adjTimerRef.current = setTimeout(() => applyAdjs(f, gAdj, cAdjs), 60)
	}

	function handleGlobalAdjChange(key: keyof Adjustments, value: number) {
		const next = { ...globalAdj, [key]: value }
		setGlobalAdj(next)
		if (font) scheduleApply(font, next, charAdjs)
	}

	function resetGlobalAdj() {
		setGlobalAdj(ADJ_ZERO)
		if (adjTimerRef.current) clearTimeout(adjTimerRef.current)
		if (font) applyAdjs(font, ADJ_ZERO, charAdjs)
	}

	function handleCharAdjChange(key: keyof Adjustments, value: number) {
		if (!selectedChar || !font) return
		const current = charAdjs.get(selectedChar) ?? ADJ_ZERO
		const next    = { ...current, [key]: value }
		const newMap  = new Map(charAdjs)
		newMap.set(selectedChar, next)
		setCharAdjs(newMap)
		scheduleApply(font, globalAdj, newMap)
	}

	function resetCharAdj() {
		if (!selectedChar || !font) return
		const newMap = new Map(charAdjs)
		newMap.delete(selectedChar)
		setCharAdjs(newMap)
		if (adjTimerRef.current) clearTimeout(adjTimerRef.current)
		applyAdjs(font, globalAdj, newMap)
	}

	function handleBezierDragStart(snapshot: PathCommand[]) {
		setBezierHistory(h => {
			const next = [...h, snapshot]
			return next.length > 50 ? next.slice(-50) : next
		})
	}

	function handleBezierUndo() {
		setBezierHistory(h => {
			if (!h.length) return h
			setBezierCmds(h[h.length - 1])
			return h.slice(0, -1)
		})
	}

	function handleBezierApply() {
		if (!font || !selectedChar) return
		// Bake bezier edits into the snapshot (pre-adjustment)
		const newSnap = new Map(origCmdsRef.current)
		const baked   = bezierCmds.map(c => ({ ...c }) as PathCommand)
		newSnap.set(selectedChar, { cmds: baked, cx: computeCx(baked) })
		origCmdsRef.current = newSnap
		// Re-apply all slider adjustments using the updated snapshot
		applyAdjs(font, globalAdj, charAdjs)
		// Re-load bezier editor from the new snapshot
		setBezierCmds(baked.map(c => ({ ...c }) as PathCommand))
		setBezierHistory([])
	}

	function handleBezierCancel() {
		// Restore snapshot (discard unsaved bezier changes)
		if (selectedChar) {
			const snap = origCmdsRef.current.get(selectedChar)
			setBezierCmds(snap ? snap.cmds.map(c => ({ ...c }) as PathCommand) : [])
		}
		setBezierHistory([])
	}

	function handleSelect(ch: string | null, rect: DOMRect) {
		setSelectedChar(ch)
		setAnchorRect(ch ? rect : null)
	}

	function closeTooltip() {
		setSelectedChar(null)
		setAnchorRect(null)
	}

	// Load the default font on mount
	useEffect(() => {
		let cancelled = false
		const abortController = new AbortController()
		setLoading(true)
		setLoadPct(0)

		async function loadDefault() {
			try {
				setLoadStage("Fetching font")
				const res = await fetch(DEFAULT_FONT_URL, { signal: abortController.signal })
				if (!res.ok) throw new Error(`HTTP ${res.status}`)

				const contentLength = Number(res.headers.get("content-length") ?? 0)
				let buffer: ArrayBuffer

				if (contentLength > 0 && res.body) {
					const reader = res.body.getReader()
					const chunks: Uint8Array[] = []
					let received = 0
					while (true) {
						const { done, value } = await reader.read()
						if (done || cancelled) { reader.cancel(); break }
						chunks.push(value)
						received += value.length
						setLoadPct(Math.round((received / contentLength) * 40))
					}
					if (cancelled) return
					const totalLength = chunks.reduce((s, c) => s + c.length, 0)
					const merged = new Uint8Array(totalLength)
					let off = 0
					for (const chunk of chunks) { merged.set(chunk, off); off += chunk.length }
					buffer = merged.buffer
				} else {
					buffer = await res.arrayBuffer()
					setLoadPct(40)
				}

				if (cancelled) return

				setLoadStage("Parsing glyphs")
				setLoadPct(42)
				await new Promise(r => setTimeout(r, 0))

				let animPct = 42
				const animTimer = setInterval(() => {
					animPct = animPct + (85 - animPct) * 0.06
					setLoadPct(Math.round(animPct))
				}, 80)

				const parsed = await parseFont(buffer, decompressWoff2).finally(() => clearInterval(animTimer))
				if (cancelled) return

				setLoadStage("Applying to page")
				setLoadPct(88)
				await new Promise(r => setTimeout(r, 0))
				snapshotFont(parsed)
				const blob = fontToBlob(parsed)
				const url  = applyFontBlob(DEMO_FAMILY, blob, blobUrlRef.current ?? undefined)
				blobUrlRef.current = url
				setLoadPct(100)
				setFont(parsed)
				setFileName(DEFAULT_FONT_NAME)
			} catch (err) {
				if (!cancelled) setError(err instanceof Error ? err.message : "Could not load default font.")
			} finally {
				if (!cancelled) { setLoading(false); setLoadStage(null); setLoadPct(0) }
			}
		}

		loadDefault()
		return () => {
			cancelled = true
			abortController.abort()
			if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
			if (adjTimerRef.current) clearTimeout(adjTimerRef.current)
		}
	}, [])

	const handleFile = useCallback(async (file: File) => {
		setLoading(true)
		setLoadPct(0)
		setError(null)
		setFont(null)
		setSelectedChar(null)
		setAnchorRect(null)
		setGlobalAdj(ADJ_ZERO)
		setCharAdjs(new Map())
		setFileName(file.name)

		try {
			setLoadStage("Parsing glyphs")
			setLoadPct(30)
			const buffer = await file.arrayBuffer()
			setLoadPct(55)
			const parsed = await parseFont(buffer, decompressWoff2)

			setLoadStage("Applying to page")
			setLoadPct(88)
			snapshotFont(parsed)
			const blob = fontToBlob(parsed)
			const url  = applyFontBlob(DEMO_FAMILY, blob, blobUrlRef.current ?? undefined)
			blobUrlRef.current = url
			setLoadPct(100)
			setFont(parsed)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not parse this font file.")
		} finally {
			setLoading(false); setLoadStage(null); setLoadPct(0)
		}
	}, [])

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (file) handleFile(file)
		e.target.value = ""
	}

	function handleDrop(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault()
		const file = e.dataTransfer.files[0]
		if (file) handleFile(file)
	}

	const charAdj = selectedChar ? (charAdjs.get(selectedChar) ?? ADJ_ZERO) : ADJ_ZERO
	const textStyle: React.CSSProperties = { fontFamily: DEMO_FAMILY, fontSize: "1.125rem", lineHeight: "1.8" }

	return (
		<div className="w-full">

			{/* Upload zone */}
			<div
				onDrop={handleDrop}
				onDragOver={e => e.preventDefault()}
				className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/20 py-8 px-6 text-center transition-colors hover:border-white/40 mb-6"
			>
				<p className="text-xs uppercase tracking-widest opacity-50">
					{loading ? (loadStage ?? "Loading…") : fileName ? `Loaded: ${fileName}` : "Drop a font file or click to browse"}
				</p>
				{fileName && !loading && fileName !== DEFAULT_FONT_NAME && (
					<p className="text-xs opacity-40 font-mono">{fileName}</p>
				)}
				<label className="text-xs px-4 py-2 rounded-full border border-white/30 cursor-pointer hover:bg-white/5 transition-colors">
					{font ? "Swap font" : "Choose TTF / OTF / WOFF / WOFF2"}
					<input type="file" accept={ACCEPT} onChange={handleInputChange} className="sr-only" aria-label="Upload a font file" />
				</label>
			</div>

			{error && <p className="text-xs text-red-400 opacity-80 mb-6">{error}</p>}

			{/* Loading progress */}
			{loading && (
				<div className="rounded-xl px-6 py-8 flex flex-col gap-4 mb-6" style={{ background: "rgba(0,0,0,0.2)" }}>
					<div className="flex items-center justify-between">
						<p className="text-xs opacity-50 tracking-widest uppercase">{loadStage ?? "Loading…"}</p>
						<p className="text-xs opacity-30 font-mono tabular-nums">{loadPct}%</p>
					</div>
					<div className="w-full h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
						<div className="h-full rounded-full transition-all duration-300"
							style={{ width: `${loadPct}%`, background: "rgba(255,255,255,0.4)" }} />
					</div>
				</div>
			)}

			{font && !loading && (
				<>
					{/* Global adjustment sliders */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
						<AdjSlider label="Width"           value={globalAdj.width}     min={-50} max={100} onChange={v => handleGlobalAdjChange("width",     v)} />
						<AdjSlider label="Shoulders"       value={globalAdj.shoulders} min={-80} max={100} onChange={v => handleGlobalAdjChange("shoulders", v)} />
						<AdjSlider label="Left thickness"  value={globalAdj.leftSide}  min={-50} max={100} onChange={v => handleGlobalAdjChange("leftSide",  v)} />
						<AdjSlider label="Right thickness" value={globalAdj.rightSide} min={-50} max={100} onChange={v => handleGlobalAdjChange("rightSide", v)} />
					</div>

					{/* Two editorial paragraphs */}
					<div className="flex flex-col gap-6 relative pb-2">
						<ClickableText text={PARA_1} selectedChar={selectedChar} onSelect={handleSelect} style={textStyle} />
						<ClickableText text={PARA_2} selectedChar={selectedChar} onSelect={handleSelect} style={textStyle} />
					</div>

					{/* Reset global */}
					<div className="flex justify-end mt-4">
						<button onClick={resetGlobalAdj} className="text-xs opacity-30 hover:opacity-60 transition-opacity">
							Reset all
						</button>
					</div>
				</>
			)}

			{/* Caption */}
			{!loading && (
				<p className="text-xs opacity-50 italic mt-6" style={{ lineHeight: "1.8" }}>
					{font
						? "Click any character to open per-glyph sliders and the bezier path editor. Global sliders reshape every glyph at once."
						: "Loaded with Inter by default — swap it for any TTF, OTF, WOFF, or WOFF2 above."
					}
				</p>
			)}

			{/* Floating tooltip — rendered in a portal via fixed position */}
			{selectedChar && anchorRect && font && (
				<Tooltip
					char={selectedChar}
					anchor={anchorRect}
					font={font}
					charAdj={charAdj}
					onCharAdjChange={handleCharAdjChange}
					onResetCharAdj={resetCharAdj}
					bezierCmds={bezierCmds}
					onBezierChange={setBezierCmds}
					onBezierDragStart={handleBezierDragStart}
					bezierHistory={bezierHistory}
					onBezierUndo={handleBezierUndo}
					onBezierApply={handleBezierApply}
					onBezierCancel={handleBezierCancel}
					onClose={closeTooltip}
				/>
			)}
		</div>
	)
}
