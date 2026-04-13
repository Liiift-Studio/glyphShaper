import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	// wawoff2 and opentype.js use Node.js built-ins — exclude from SSR bundle
	serverExternalPackages: ["wawoff2", "opentype.js"],

	// Stub fs/path for the browser build — wawoff2 conditionally requires them
	// but never actually needs them in the browser/WASM context
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
