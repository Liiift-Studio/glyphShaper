// Server-side WOFF2 decompression — keeps wawoff2 (Node.js-only) out of the browser bundle.
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	const bytes = new Uint8Array(await req.arrayBuffer())
	const { decompress } = await import('wawoff2')
	const result: Uint8Array = await decompress(bytes)
	return new NextResponse(result.buffer as ArrayBuffer, {
		headers: { 'Content-Type': 'application/octet-stream' },
	})
}
