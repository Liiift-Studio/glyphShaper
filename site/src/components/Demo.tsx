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

export default function Demo() {
	const [font, setFont]         = useState<GlyphFont | null>(null)
	const [fileName, setFileName] = useState<string>("")
	const [loading, setLoading]   = useState(false)
	const [error, setError]       = useState<string | null>(null)

	// Track current Blob URL so we revoke it when a new font is loaded
	const blobUrlRef = useRef<string | null>(null)

	// Load the default font on mount
	useEffect(() => {
		let cancelled = false
		setLoading(true)

		async function loadDefault() {
			try {
				const res = await fetch(DEFAULT_FONT_URL)
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				const buffer = await res.arrayBuffer()
				if (cancelled) return
				const parsed = await parseFont(buffer)
				if (cancelled) return
				const blob = fontToBlob(parsed)
				const url  = applyFontBlob(DEMO_FAMILY, blob, blobUrlRef.current ?? undefined)
				blobUrlRef.current = url
				setFont(parsed)
				setFileName(DEFAULT_FONT_NAME)
			} catch {
				// Silently fail — user can still upload their own font
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		loadDefault()
		return () => { cancelled = true }
	}, [])

	const handleFile = useCallback(async (file: File) => {
		setLoading(true)
		setError(null)
		setFont(null)
		setFileName(file.name)

		try {
			const buffer = await file.arrayBuffer()
			const parsed = await parseFont(buffer)

			// Apply the font immediately so the preview text renders with it
			const blob = fontToBlob(parsed)
			const url  = applyFontBlob(DEMO_FAMILY, blob, blobUrlRef.current ?? undefined)
			blobUrlRef.current = url

			setFont(parsed)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not parse this font file.")
		} finally {
			setLoading(false)
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
					{loading ? "Parsing…" : fileName ? `Loaded: ${fileName}` : "Drop a font file or click to browse"}
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
			) : (
				loading && (
					<div className="rounded-xl px-6 py-10 text-center" style={{ background: "rgba(0,0,0,0.2)" }}>
						<p className="text-sm opacity-30">Loading font…</p>
					</div>
				)
			)}

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
