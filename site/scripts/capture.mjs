// README visual capture harness for glyphShaper.
// Boots the Next.js site dev server, drives the live interactive demo with
// Playwright, and writes screenshots to ../assets/ for the package README.
//
// Run from glyphShaper/site/:  node scripts/capture.mjs
// Requires: npm i -D playwright && npx playwright install chromium
//
// Reproducible: deterministic font (bundled Inter), fixed viewport, fixed
// character/slider interactions. Re-run after UI changes and bump the ?v=N
// cache buster in the README.

import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_DIR = join(__dirname, "..")
const ASSETS_DIR = join(SITE_DIR, "..", "assets")
const PORT = 3105
const BASE = `http://localhost:${PORT}`

mkdirSync(ASSETS_DIR, { recursive: true })

// ─── Boot the dev server ───────────────────────────────────────────────────
console.log("Starting Next.js dev server on port %d…", PORT)
const dev = spawn("npx", ["next", "dev", "-p", String(PORT)], {
	cwd: SITE_DIR,
	stdio: ["ignore", "pipe", "pipe"],
	env: { ...process.env },
})
dev.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`))
dev.stderr.on("data", (d) => process.stderr.write(`[next] ${d}`))

// Wait for the server to answer 200 on the home route
async function waitForServer(timeoutMs = 120000) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(BASE, { method: "GET" })
			if (res.ok) return
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 800))
	}
	throw new Error("Dev server did not become ready in time")
}

function shutdown() {
	try {
		dev.kill("SIGTERM")
	} catch {
		// ignore
	}
}

// The demo section is the second <section> on the page (hero, demo, how-it-works…).
const DEMO_SECTION = "main > section:nth-of-type(2)"

// Characters render as span[role=button][aria-label="Select character X"].
const charSel = (ch) => `[role="button"][aria-label="Select character ${ch}"]`

// Move a range input to a target value and fire input/change events React listens to.
async function setSlider(scope, label, value) {
	const input = scope.locator(`#adj-${label}`).first()
	if (!(await input.count())) return false
	await input.evaluate((el, v) => {
		const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
		setter.call(el, String(v))
		el.dispatchEvent(new Event("input", { bubbles: true }))
		el.dispatchEvent(new Event("change", { bubbles: true }))
	}, value)
	return true
}

try {
	await waitForServer()
	console.log("Server ready. Launching headless Chromium…")

	const browser = await chromium.launch()
	const page = await browser.newPage({
		deviceScaleFactor: 2,
		viewport: { width: 1280, height: 1400 },
		colorScheme: "dark",
	})

	await page.goto(BASE, { waitUntil: "networkidle" })
	await page.evaluate(() => document.fonts.ready)

	// Inter auto-loads on mount; editorial text + clickable chars appear once parsed.
	await page.waitForSelector(charSel("a"), { timeout: 60000 })
	await page.waitForTimeout(1000) // let glyphs paint

	const demo = page.locator(DEMO_SECTION).first()
	await demo.scrollIntoViewIfNeeded()
	await page.waitForTimeout(300)

	// ─── Scene 1 (hero): global sliders reshape every glyph, editor open on Path tab ──
	// Push global Width + Shoulders so the editorial prose visibly distorts.
	await setSlider(page, "width", 55)
	await setSlider(page, "shoulders", 70)
	await page.waitForTimeout(400)

	// Open the bezier editor on a glyph with rich curves.
	for (const ch of ["g", "a", "e", "s"]) {
		const tile = page.locator(charSel(ch)).first()
		if (await tile.count()) {
			await tile.click()
			break
		}
	}
	await page.waitForSelector('[role="dialog"][aria-label^="Glyph editor"]', { timeout: 10000 })
	const dialog = page.locator('[role="dialog"][aria-label^="Glyph editor"]').first()
	// Switch to the Path tab to reveal the SVG bezier editor.
	const pathTab = dialog.locator('[role="tab"]', { hasText: /^path$/i }).first()
	if (await pathTab.count()) {
		await pathTab.click()
		await page.waitForTimeout(700)
	}
	await page.waitForTimeout(500)

	await page.screenshot({
		path: join(ASSETS_DIR, "hero.png"),
		clip: await clipOf(page, DEMO_SECTION),
	})
	console.log("captured assets/hero.png")

	// ─── Scene 2 (editor close-up): the floating glyph editor panel itself ──────
	await page.screenshot({
		path: join(ASSETS_DIR, "editor.png"),
		clip: await clipOf(page, '[role="dialog"][aria-label^="Glyph editor"]'),
	})
	console.log("captured assets/editor.png")

	await browser.close()
	console.log("Done.")
} catch (err) {
	console.error("Capture failed:", err)
	process.exitCode = 1
} finally {
	shutdown()
}

// Return a bounding-box clip for a selector, trimmed to the viewport.
async function clipOf(page, selector) {
	const box = await page.locator(selector).first().boundingBox()
	if (!box) return undefined
	const vw = page.viewportSize().width
	const vh = page.viewportSize().height
	const x = Math.max(0, box.x)
	const y = Math.max(0, box.y)
	return {
		x,
		y,
		width: Math.min(box.width, vw - x),
		height: Math.min(box.height, vh - y),
	}
}
