import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
	title: "glyphShaper — Live glyph path editor for the browser",
	icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
	description: "Click any character, drag its bezier control points, and every instance on the page updates instantly. opentype.js-powered font regeneration — no server, no export.",
	keywords: ["typography", "glyph", "bezier", "font editor", "opentype", "path editing", "font-face", "interactive", "TypeScript", "npm", "react"],
	openGraph: {
		title: "glyphShaper — Live glyph path editor for the browser",
		description: "Click any character, reshape its bezier curves, watch every instance update. A precision glyph editing tool powered by opentype.js.",
		url: "https://glyphshaper.com",
		siteName: "glyphShaper",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "glyphShaper — Live glyph path editor for the browser",
		description: "Click any character, reshape its bezier curves, watch every instance update instantly.",
	},
	metadataBase: new URL("https://glyphshaper.com"),
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className="h-full antialiased">
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	)
}
