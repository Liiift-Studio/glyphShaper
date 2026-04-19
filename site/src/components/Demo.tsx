"use client"

// Interactive demo — loads Inter by default; file upload replaces it
import { useState, useRef, useCallback, useEffect } from "react"
import { parseFont, applyFontBlob, fontToBlob, getGlyphCommands, setGlyphCommands } from "@liiift-studio/glyphshaper"
import { GlyphShaperEditor } from "@liiift-studio/glyphshaper"
import type { GlyphFont, PathCommand } from "@liiift-studio/glyphshaper"

/** CSS font-family name used for the demo override rule */
const DEMO_FAMILY = "GlyphShaperDemo"

/** Sample text whose characters populate the editor palette */
const SAMPLE = "Typography"

/** Body text shown below the heading — used to determine which glyphs to snapshot */
const BODY_TEXT = "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs."

/** All characters visible in the demo — only these are snapshotted for global adjustments */
const DEMO_CHARS = SAMPLE + BODY_TEXT

/** Accepted font file extensions */
const ACCEPT = ".ttf,.otf,.woff,.woff2"

/** URL of the default font bundled with the site */
const DEFAULT_FONT_URL = "/fonts/inter-300.woff"

/** Server-side WOFF2 decompressor — keeps wawoff2 out of the browser bundle */
async function decompressWoff2(buffer: ArrayBuffer): Promise<ArrayBuffer> {
	const res = await fetch("/api/decompress-woff2", { method: "POST", body: buffer })
	if (!res.ok) throw new Error(`WOFF2 decompression failed (${res.status})`)
	return res.arrayBuffer()
}

/** Display name shown in the upload zone for the default font */
const DEFAULT_FONT_NAME = "Inter"

/** Loading stages shown in the progress bar */
const LOAD_STAGES = ["Fetching font", "Parsing glyphs", "Applying to page"] as const
type LoadStage = typeof LOAD_STAGES[number] | null

// ─── Global adjustments ───────────────────────────────────────────────────────

type Adjustments = {
	/** Uniform horizontal scale (%) around the glyph's own centre */
	width: number
	/** Extra scale applied only to the left half of the glyph (%) */
	leftSide: number
	/** Extra scale applied only to the right half of the glyph (%) */
	rightSide: number
	/** Scale Bézier handle offsets from their nearest anchor (%) */
	shoulders: number
}

const ADJ_ZERO: Adjustments = { width: 0, leftSide: 0, rightSide: 0, shoulders: 0 }

type GlyphSnapshot = { cmds: PathCommand[]; cx: number }

/** Compute the horizontal midpoint of a glyph's bounding box */
function computeCx(cmds: PathCommand[]): number {
	let minX = Infinity, maxX = -Infinity
	for (const cmd of cmds) {
		if ("x"  in cmd) { if (cmd.x  < minX) minX = cmd.x;  if (cmd.x  > maxX) maxX = cmd.x  }
		if ("x1" in cmd) { if (cmd.x1 < minX) minX = cmd.x1; if (cmd.x1 > maxX) maxX = cmd.x1 }
		if ("x2" in cmd) { if (cmd.x2 < minX) minX = cmd.x2; if (cmd.x2 > maxX) maxX = cmd.x2 }
	}
	return minX === Infinity ? 0 : (minX + maxX) / 2
}

/** Apply width + left/right thickness to a single x coordinate */
function adjX(x: number, cx: number, width: number, leftSide: number, rightSide: number): number {
	let nx = cx + (x - cx) * (1 + width / 100)
	const d = nx - cx
	if      (d < 0) nx = cx + d * (1 + leftSide  / 100)
	else if (d > 0) nx = cx + d * (1 + rightSide / 100)
	return nx
}

/** Rebuild path commands with all four adjustments applied */
function applyTransform(cmds: PathCommand[], cx: number, adj: Adjustments): PathCommand[] {
	const { width, leftSide, rightSide, shoulders } = adj
	const tx = (x: number) => adjX(x, cx, width, leftSide, rightSide)
	let px = 0, py = 0
	return cmds.map(cmd => {
		if (cmd.type === "Z") return { type: "Z" }
		if (cmd.type === "M") {
			const nx = tx(cmd.x)
			px = nx; py = cmd.y
			return { type: "M", x: nx, y: cmd.y }
		}
		if (cmd.type === "L") {
			const nx = tx(cmd.x)
			px = nx; py = cmd.y
			return { type: "L", x: nx, y: cmd.y }
		}
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

function AdjSlider({
	label, value, min, max, onChange,
}: {
	label: string; value: number; min: number; max: number
	onChange: (v: number) => void
}) {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between items-baseline">
				<label className="text-xs opacity-50">{label}</label>
				<span className="text-xs opacity-30 font-mono tabular-nums" style={{ minWidth: "2.5rem", textAlign: "right" }}>
					{value > 0 ? `+${value}` : value}
				</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={1}
				value={value}
				aria-label={label}
				onChange={e => onChange(Number(e.target.value))}
				className="w-full"
			/>
		</div>
	)
}

// ─── Demo component ───────────────────────────────────────────────────────────

export default function Demo() {
	const [font, setFont]         = useState<GlyphFont | null>(null)
	const [fileName, setFileName] = useState<string>("")
	const [loading, setLoading]   = useState(false)
	const [loadStage, setLoadStage] = useState<LoadStage>(null)
	const [loadPct, setLoadPct]   = useState(0)
	const [error, setError]       = useState<string | null>(null)
	const [adj, setAdj]           = useState<Adjustments>(ADJ_ZERO)

	// Track current Blob URL so we revoke it when a new font is loaded
	const blobUrlRef   = useRef<string | null>(null)
	// Original glyph commands (per character) captured immediately after parse
	const origCmdsRef  = useRef<Map<string, GlyphSnapshot>>(new Map())
	// Debounce timer for slider changes
	const adjTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

	/** Snapshot original commands for every visible demo character */
	function snapshotFont(f: GlyphFont) {
		const snap = new Map<string, GlyphSnapshot>()
		const seen = new Set<string>()
		for (const ch of DEMO_CHARS) {
			if (seen.has(ch) || ch === " ") continue
			seen.add(ch)
			const cmds = getGlyphCommands(f, ch)
			if (!cmds.length) continue
			snap.set(ch, { cmds, cx: computeCx(cmds) })
		}
		origCmdsRef.current = snap
	}

	/** Write adjusted glyph commands back into the font, regenerate blob, reinject @font-face */
	function applyAdj(f: GlyphFont, a: Adjustments) {
		const isZero = (Object.keys(a) as (keyof Adjustments)[]).every(k => a[k] === 0)
		for (const [ch, { cmds, cx }] of origCmdsRef.current) {
			const transformed = isZero
				? cmds.map(c => ({ ...c }) as PathCommand)
				: applyTransform(cmds, cx, a)
			setGlyphCommands(f, ch, transformed)
		}
		const blob = fontToBlob(f)
		const url  = applyFontBlob(DEMO_FAMILY, blob, blobUrlRef.current ?? undefined)
		blobUrlRef.current = url
	}

	/** Update one slider field and debounce the font regen */
	function handleAdjChange(key: keyof Adjustments, value: number) {
		const next = { ...adj, [key]: value }
		setAdj(next)
		if (adjTimerRef.current) clearTimeout(adjTimerRef.current)
		adjTimerRef.current = setTimeout(() => {
			if (font) applyAdj(font, next)
		}, 60)
	}

	/** Reset all sliders to zero and immediately restore original outlines */
	function resetAdj() {
		setAdj(ADJ_ZERO)
		if (adjTimerRef.current) clearTimeout(adjTimerRef.current)
		if (font) applyAdj(font, ADJ_ZERO)
	}

	// Load the default font on mount
	useEffect(() => {
		let cancelled = false
		const abortController = new AbortController()
		setLoading(true)
		setLoadPct(0)

		async function loadDefault() {
			try {
				// Stage 1 — fetch with progress tracking via streaming
				setLoadStage("Fetching font")
				const res = await fetch(DEFAULT_FONT_URL, { signal: abortController.signal })
				if (!res.ok) throw new Error(`HTTP ${res.status}`)

				// Only stream if Content-Length is available — avoids locking the body
				// when falling back to arrayBuffer() on responses without it.
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

				// Stage 2 — parse glyphs (opentype.js, async).
				// parseFont has no progress callbacks, so animate the bar toward 85%
				// with an exponential ease that slows as it approaches the ceiling.
				setLoadStage("Parsing glyphs")
				setLoadPct(42)
				await new Promise(r => setTimeout(r, 0)) // yield to UI

				let animPct = 42
				const animTimer = setInterval(() => {
					animPct = animPct + (85 - animPct) * 0.06
					setLoadPct(Math.round(animPct))
				}, 80)

				const parsed = await parseFont(buffer, decompressWoff2).finally(() => clearInterval(animTimer))
				if (cancelled) return

				// Stage 3 — serialise to Blob and inject @font-face
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
				if (!cancelled) {
					setLoading(false)
					setLoadStage(null)
					setLoadPct(0)
				}
			}
		}

		loadDefault()
		return () => {
			cancelled = true
			abortController.abort()
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current)
				blobUrlRef.current = null
			}
			if (adjTimerRef.current) clearTimeout(adjTimerRef.current)
		}
	}, [])

	const handleFile = useCallback(async (file: File) => {
		setLoading(true)
		setLoadPct(0)
		setError(null)
		setFont(null)
		setAdj(ADJ_ZERO)
		setFileName(file.name)

		try {
			setLoadStage("Parsing glyphs")
			setLoadPct(30)
			const buffer = await file.arrayBuffer()
			setLoadPct(55)
			const parsed = await parseFont(buffer, decompressWoff2)

			// Apply the font immediately so the preview text renders with it
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
			setLoading(false)
			setLoadStage(null)
			setLoadPct(0)
		}
	}, [])

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (file) handleFile(file)
		// Reset input so the same file can be re-selected if needed
		e.target.value = ""
	}

	function handleDrop(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault()
		const file = e.dataTransfer.files[0]
		if (file) handleFile(file)
	}

	return (
		<div className="w-full flex flex-col gap-6">

			{/* Upload zone */}
			<div
				onDrop={handleDrop}
				onDragOver={e => e.preventDefault()}
				className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/20 py-8 px-6 text-center transition-colors hover:border-white/40"
			>
				<p className="text-xs uppercase tracking-widest opacity-50">
					{loading ? (loadStage ?? "Loading…") : fileName ? `Loaded: ${fileName}` : "Drop a font file or click to browse"}
				</p>
				{fileName && !loading && fileName !== DEFAULT_FONT_NAME && (
					<p className="text-xs opacity-40 font-mono">{fileName}</p>
				)}
				<label className="text-xs px-4 py-2 rounded-full border border-white/30 cursor-pointer hover:bg-white/5 transition-colors">
					{font ? "Swap font" : "Choose TTF / OTF / WOFF / WOFF2"}
					<input
						type="file"
						accept={ACCEPT}
						onChange={handleInputChange}
						className="sr-only"
						aria-label="Upload a font file"
					/>
				</label>
			</div>

			{/* Error */}
			{error && (
				<p className="text-xs text-red-400 opacity-80">{error}</p>
			)}

			{/* Loading progress — shown while font is loading */}
			{loading && (
				<div className="rounded-xl px-6 py-8 flex flex-col gap-4" style={{ background: "rgba(0,0,0,0.2)" }}>
					<div className="flex items-center justify-between">
						<p className="text-xs opacity-50 tracking-widest uppercase">{loadStage ?? "Loading…"}</p>
						<p className="text-xs opacity-30 font-mono tabular-nums">{loadPct}%</p>
					</div>
					<div className="w-full h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
						<div
							className="h-full rounded-full transition-all duration-300"
							style={{ width: `${loadPct}%`, background: "rgba(255,255,255,0.4)" }}
						/>
					</div>
					<p className="text-xs opacity-20">Inter · WOFF · 22 KB</p>
				</div>
			)}

			{/* Global adjustment sliders — shown once a font is loaded */}
			{font && !loading && (
				<div className="rounded-xl px-6 py-5 flex flex-col gap-4" style={{ background: "rgba(0,0,0,0.2)" }}>
					<div className="flex items-center justify-between">
						<p className="text-xs uppercase tracking-widest opacity-50">Global adjustments</p>
						<button
							onClick={resetAdj}
							className="text-xs opacity-40 hover:opacity-70 transition-opacity"
							aria-label="Reset all adjustments"
						>
							Reset
						</button>
					</div>
					<div className="grid grid-cols-2 gap-x-8 gap-y-4">
						<AdjSlider label="Width"           value={adj.width}     min={-50} max={100} onChange={v => handleAdjChange("width",     v)} />
						<AdjSlider label="Shoulders"       value={adj.shoulders} min={-80} max={100} onChange={v => handleAdjChange("shoulders", v)} />
						<AdjSlider label="Left thickness"  value={adj.leftSide}  min={-50} max={100} onChange={v => handleAdjChange("leftSide",  v)} />
						<AdjSlider label="Right thickness" value={adj.rightSide} min={-50} max={100} onChange={v => handleAdjChange("rightSide", v)} />
					</div>
				</div>
			)}

			{/* Editor — only shown once a font is loaded */}
			{font ? (
				<div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.25)" }}>
					<div className="px-6 py-6">
						<GlyphShaperEditor font={font} fontFamily={DEMO_FAMILY} text={SAMPLE}>
							{/* Sample text rendered with the uploaded font */}
							<p
								style={{
									fontFamily: DEMO_FAMILY,
									fontSize: "clamp(2rem, 8vw, 5rem)",
									lineHeight: 1.1,
									letterSpacing: "-0.02em",
									marginBottom: "0.5em",
								}}
							>
								{SAMPLE}
							</p>
							<p
								style={{
									fontFamily: DEMO_FAMILY,
									fontSize: "clamp(0.9rem, 2vw, 1.1rem)",
									lineHeight: 1.6,
									opacity: 0.7,
									maxWidth: "42ch",
								}}
							>
								{BODY_TEXT}
							</p>
						</GlyphShaperEditor>
					</div>
				</div>
			) : null}

			<p className="text-xs opacity-50 italic" style={{ lineHeight: "1.8" }}>
				Loaded with Inter by default — swap it for any TTF, OTF, WOFF, or WOFF2 above.
				Use the global sliders to reshape every glyph at once, or click a character tile to open its bezier path editor.
				Drag anchors (filled circles) or handles (outlined circles) to reshape individual glyphs.
				Hit <strong>Apply to page</strong> and every instance — headings, body text,
				wherever that font-family is used — re-renders instantly via a dynamic{" "}
				<code className="font-mono">@font-face</code> override. No server. No export.
				Changes reset on page reload.
			</p>
		</div>
	)
}
