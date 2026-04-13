import Demo from "@/components/Demo"
import CopyInstall from "@/components/CopyInstall"
import CodeBlock from "@/components/CodeBlock"
import ToolDirectory from "@/components/ToolDirectory"
import { version } from "../../../package.json"

export default function Home() {
	return (
		<main className="flex flex-col items-center px-6 py-20 gap-24">

			{/* Hero */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<p className="text-xs uppercase tracking-widest opacity-50">glyphforge</p>
					<h1 className="text-4xl lg:text-8xl xl:text-9xl" style={{ lineHeight: "1.05em", letterSpacing: "-0.02em" }}>
						Edit a glyph.<br />
						<span style={{ opacity: 0.5, fontStyle: "italic" }}>Watch it everywhere.</span>
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<CopyInstall />
					<a href="https://github.com/Liiift-Studio/glyphForge" className="text-sm opacity-50 hover:opacity-100 transition-opacity">GitHub</a>
				</div>
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-50 tracking-wide">
					<span>TypeScript</span><span>·</span><span>opentype.js</span><span>·</span><span>React + Vanilla JS</span><span>·</span><span>No server</span>
				</div>
				<p className="text-base opacity-60 leading-relaxed max-w-lg">
					Click any character, drag its bezier control points to reshape the outline, then
					hit Apply. glyphForge regenerates the font binary in the browser and injects a
					dynamic <code className="text-xs font-mono">@font-face</code> override — every
					instance of that character on the page re-renders instantly. No server, no export,
					no page reload.
				</p>
			</section>

			{/* Demo */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-4">
				<p className="text-xs uppercase tracking-widest opacity-50">Live demo — upload any TTF or OTF</p>
				<div className="rounded-xl -mx-8 px-8 py-8" style={{ background: "rgba(0,0,0,0.25)", overflow: "hidden" }}>
					<Demo />
				</div>
			</section>

			{/* Explanation */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">How it works</p>
				<div className="prose-grid grid grid-cols-1 sm:grid-cols-2 gap-12 text-sm leading-relaxed opacity-70">
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Parse, edit, regenerate</p>
						<p>glyphForge uses opentype.js to parse the uploaded font binary into a structured
						object. Each glyph&apos;s <code className="text-xs font-mono">path.commands</code> array
						— moveTo, lineTo, curveTo, quadraticCurveTo — is exposed as draggable SVG control
						points. When you hit Apply, the modified font object is serialised back to an
						ArrayBuffer via <code className="text-xs font-mono">font.toArrayBuffer()</code>.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Dynamic @font-face injection</p>
						<p>The regenerated buffer becomes a Blob URL. A <code className="text-xs font-mono">{'<style>'}</code> element
						is injected (or replaced) in <code className="text-xs font-mono">{'<head>'}</code> with a new{" "}
						<code className="text-xs font-mono">@font-face</code> rule pointing at that URL.
						The browser immediately re-renders any element using that font&#8209;family —
						headings, body text, buttons — with the modified glyph outline.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Bezier control points</p>
						<p>Glyph outlines use cubic and quadratic Bézier segments. Anchor points
						(filled circles) are on-curve endpoints. Handle points (outlined circles)
						are off-curve control handles that pull the curve without touching it.
						Moving handles reshapes the curve smoothly; moving anchors shifts the
						segment endpoint. Pointer capture keeps the drag working even when the
						cursor leaves the SVG area.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Ephemeral by design</p>
						<p>Every edit lives entirely in the browser&apos;s memory. The original font
						file is never written to disk. Refreshing the page resets everything.
						This makes glyphForge ideal for live demos, design explorations, and
						teaching moments — low commitment, instant feedback, no pipeline.</p>
					</div>
				</div>
			</section>

			{/* Usage */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex items-baseline gap-4">
					<p className="text-xs uppercase tracking-widest opacity-50">Usage</p>
					<p className="text-xs opacity-50 tracking-wide">TypeScript + React · Vanilla JS</p>
				</div>
				<div className="flex flex-col gap-8 text-sm">
					<div className="flex flex-col gap-3">
						<p className="opacity-50">Drop-in editor component</p>
						<CodeBlock code={`import { useGlyphFont, GlyphForgeEditor } from '@liiift-studio/glyphforge'

const { font } = useGlyphFont('/fonts/MyFont.ttf')

<GlyphForgeEditor font={font} fontFamily="MyFont" text="Heading">
  <h1 style={{ fontFamily: 'MyFont' }}>Heading</h1>
</GlyphForgeEditor>`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="opacity-50">Load from uploaded File</p>
						<CodeBlock code={`import { useGlyphFont } from '@liiift-studio/glyphforge'

// Pass a File object from an <input type="file"> onChange handler
const { font, loading, error } = useGlyphFont(file)`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="opacity-50">Low-level — vanilla JS</p>
						<CodeBlock code={`import {
  parseFont, getGlyphCommands, setGlyphCommands,
  fontToBlob, applyFontBlob,
} from '@liiift-studio/glyphforge'

const res    = await fetch('/fonts/MyFont.ttf')
const buffer = await res.arrayBuffer()
const font   = await parseFont(buffer)

// Read glyph path commands
const cmds = getGlyphCommands(font, 'A')

// Modify — e.g. shift all anchor y values up by 50 units
const shifted = cmds.map(c =>
  c.type !== 'Z' ? { ...c, y: c.y + 50 } : c
)

// Write back and apply
setGlyphCommands(font, 'A', shifted)
const url = applyFontBlob('MyFont', fontToBlob(font))
// All elements using font-family: MyFont now show the shifted A`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="opacity-50">API</p>
						<table className="w-full text-xs">
							<thead>
								<tr className="opacity-50 text-left">
									<th className="pb-2 pr-6 font-normal">Function</th>
									<th className="pb-2 font-normal">Description</th>
								</tr>
							</thead>
							<tbody className="opacity-70">
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors">
									<td className="py-2 pr-6 font-mono">parseFont(buffer)</td>
									<td className="py-2">Parse an ArrayBuffer (TTF, OTF, WOFF1, or WOFF2) into a GlyphFont handle.</td>
								</tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors">
									<td className="py-2 pr-6 font-mono">getGlyphCommands(font, char)</td>
									<td className="py-2">Return a deep copy of the path commands for a character.</td>
								</tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors">
									<td className="py-2 pr-6 font-mono">setGlyphCommands(font, char, cmds)</td>
									<td className="py-2">Write modified commands back into the font object (mutates in place).</td>
								</tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors">
									<td className="py-2 pr-6 font-mono">fontToBlob(font)</td>
									<td className="py-2">Serialise the font to a Blob (OTF binary).</td>
								</tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors">
									<td className="py-2 pr-6 font-mono">applyFontBlob(family, blob)</td>
									<td className="py-2">Inject a @font-face override; returns the Blob URL for later cleanup.</td>
								</tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors">
									<td className="py-2 pr-6 font-mono">revokeFont(url)</td>
									<td className="py-2">Revoke the Blob URL and remove the override style element.</td>
								</tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors">
									<td className="py-2 pr-6 font-mono">useGlyphFont(source)</td>
									<td className="py-2">React hook — accepts a URL string or File; returns {'{font, loading, error}'}.</td>
								</tr>
							</tbody>
						</table>
					</div>
					<div className="flex flex-col gap-3">
						<p className="opacity-50">Font format support</p>
						<p className="text-xs opacity-60 leading-relaxed">
							glyphForge accepts <strong>TTF, OTF, WOFF1, and WOFF2</strong>. WOFF2 is
							transparently decompressed in the browser using{" "}
							<code className="font-mono">wawoff2</code> (a WASM brotli decoder) before
							being passed to opentype.js — no conversion step needed.
						</p>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6 pt-8 border-t border-white/10 text-xs">
				<ToolDirectory current="glyphForge" />
				<hr className="border-white/10" />
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 opacity-50">
					<a href="https://liiift.studio" className="hover:opacity-100 transition-opacity">liiift.studio</a>
					<span className="sm:col-start-4">glyphForge v{version}</span>
				</div>
			</footer>

		</main>
	)
}
