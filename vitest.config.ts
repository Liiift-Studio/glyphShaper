// vitest.config.ts — test configuration using happy-dom environment
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'happy-dom',
	},
})
