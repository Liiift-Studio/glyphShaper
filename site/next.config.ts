import type { NextConfig } from "next"
import path from "path"

const nextConfig: NextConfig = {
	// wawoff2 and opentype.js use Node.js built-ins — exclude from SSR bundle
	serverExternalPackages: ["wawoff2", "opentype.js"],

	// Turbopack: stub fs/path for browser build (wawoff2 conditionally requires them)
	turbopack: {
		root: path.resolve(__dirname, ".."),
		resolveAlias: {
			fs:   { browser: path.resolve(__dirname, "stubs/node-empty.js"), default: "node:fs" },
			path: { browser: path.resolve(__dirname, "stubs/node-empty.js"), default: "node:path" },
		},
	},

	// Webpack fallback (used if Turbopack is not active)
	webpack: (config, { isServer }) => {
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs:   false,
				path: false,
			}
		}
		return config
	},
}

export default nextConfig
