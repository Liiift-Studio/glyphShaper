import type { NextConfig } from "next"
import path from "path"

const nextConfig: NextConfig = {
	turbopack: { root: path.resolve(__dirname, "..") },
	// wawoff2 and opentype.js use Node.js built-ins (fs, path) — exclude from server bundle
	serverExternalPackages: ["wawoff2", "opentype.js"],
}

export default nextConfig
