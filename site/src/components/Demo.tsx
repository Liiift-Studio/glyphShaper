"use client"

// Interactive demo — loads Merriweather by default; file upload replaces it
import { useState, useRef, useCallback, useEffect } from "react"
import { parseFont, applyFontBlob, fontToBlob } from "@liiift-studio/glyphshaper"
import { GlyphShaperEditor } from "@liiift-studio/glyphshaper"
import type { GlyphFont } from "@liiift-studio/glyphshaper"

/** CSS font-family name used for the demo override rule */
const DEMO_FAMILY = "GlyphShaperDemo"

/** Sample text whose characters populate the editor palette */
const SAMPLE = "Typography"

/** Accepted font file extensions */
const ACCEPT = ".ttf,.otf,.woff,.woff2"

/** URL of the default font bundled with the site */
const DEFAULT_FONT_URL = "/fonts/Merriweather.woff2"

/** Display name shown in the upload zone for the default font */
const DEFAULT_FONT_NAME = "Merriweather"

/** Loading stages shown in the progress bar */
const LOAD_STAGES = ["Fetching font", "Decoding WOFF2", "Parsing glyphs", "Applying to page"] as const
type LoadStage = typeof LOAD_STAGES[number] | null

export default function Demo() {
	const [font, setFont]         = useState<GlyphFont | null>(null)
	const [fileName, setFileName] = useState<string>("")
	const [loading, setLoading]   = useState(false)
	const [loadStage, setLoadStage] = useState<LoadStage>(null)
	const [loadPct, setLoadPct]   = useState(0)
	const [error, setError]       = useState<string | null>(null)

	// Track current Blob URL so we revoke it when a new font is loaded
	const blobUrlRef = useRef<string | null>(null)

	// Load the default font on mount
	useEffect(() => {
		let cancelled = false
		setLoading(true)
		setLoadPct(0)

		async function loadDefault() {
			try {
				// Stage 1 — fetch with progress tracking via streaming
				setLoadStage("Fetching font")
				const res = await fetch(DEFAULT_FONT_URL)
				if (!res.ok) throw new Error(`HTTP ${res.status}`)

				// Stream the response so we can track download progress
				const contentLength = Number(res.headers.get("content-length") ?? 0)
				const reader = res.body?.getReader()
				const chunks: Uint8Array[] = []
				let received = 0

				if (reader && contentLength > 0) {
					while (true) {
						const { done, value } = await reader.read()
						if (done || cancelled) break
						chunks.push(value)
						received += value.length
						setLoadPct(Math.round((received / contentLength) * 40))
					}
				} else {
					// Fallback — no content-length, read all at once
					const fallback = await (reader ? res.arrayBuffer() : res.clone().arrayBuffer())
					chunks.push(new Uint8Array(fallback instanceof ArrayBuffer ? fallback : await fallback))
					setLoadPct(40)
				}

				if (cancelled) return

				// Reassemble into ArrayBuffer
				const totalLength = chunks.reduce((s, c) => s + c.length, 0)
				const merged = new Uint8Array(totalLength)
				let offset = 0
				for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }
				const buffer = merged.buffer

				// Stage 2 — decode WOFF2 + parse glyphs (opentype.js, async).
				// parseFont has no progress callbacks, so animate the bar toward 85%
				// with an exponential ease that slows as it approaches the ceiling.
				setLoadStage("Decoding WOFF2")
				setLoadPct(42)
				await new Promise(r => setTimeout(r, 0)) // yield to UI

				let animPct = 42
				const animTimer = setInterval(() => {
					animPct = animPct + (85 - animPct) * 0.06
					setLoadPct(Math.round(animPct))
					if (animPct > 83) setLoadStage("Parsing glyphs")
				}, 80)

				const parsed = await parseFont(buffer).finally(() => clearInterval(animTimer))
				if (cancelled) return

				// Stage 3 — serialise to Blob and inject @font-face
				setLoadStage("Applying to page")
				setLoadPct(88)
				await new Promise(r => setTimeout(r, 0))
				const blob = fontToBlob(parsed)
				const url  = applyFontBlob(DEMO_FAMILY, blob, blobUrlRef.current ?? undefined)
				blobUrlRef.current = url
				setLoadPct(100)
				setFont(parsed)
				setFileName(DEFAULT_FONT_NAME)
			} catch {
				// Silently fail — user can still upload their own font
			} finally {
				if (!cancelled) {
					setLoading(false)
					setLoadStage(null)
					setLoadPct(0)
				}
			}
		}

		loadDefault()
		return () => { cancelled = true }
	}, [])

	const handleFile = useCallback(async (file: File) => {
		setLoading(true)
		setLoadPct(0)
		setError(null)
		setFont(null)
		setFileName(file.name)

		try {
			setLoadStage("Parsing glyphs")
			setLoadPct(30)
			const buffer = await file.arrayBuffer()
			setLoadPct(55)
			const parsed = await parseFont(buffer)

			// Apply the font immediately so the preview text renders with it
			setLoadStage("Applying to page")
			setLoadPct(88)
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
					<p className="text-xs opacity-20">Merriweather · WOFF2 · 499 KB</p>
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
								The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
							</p>
						</GlyphShaperEditor>
					</div>
				</div>
			) : null}

			<p className="text-xs opacity-50 italic" style={{ lineHeight: "1.8" }}>
				Loaded with Merriweather by default — swap it for any TTF, OTF, WOFF, or WOFF2 above.
				Click a character tile to open its bezier path editor.
				Drag anchors (filled circles) or handles (outlined circles) to reshape the glyph.
				Hit <strong>Apply to page</strong> and every instance — headings, body text,
				wherever that font-family is used — re-renders instantly via a dynamic{" "}
				<code className="font-mono">@font-face</code> override. No server. No export.
				Changes reset on page reload.
			</p>
		</div>
	)
}
