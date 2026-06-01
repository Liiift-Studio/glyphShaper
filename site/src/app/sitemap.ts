// Sitemap for glyphshaper.com — single root URL.

import type { MetadataRoute } from 'next'

/** Static sitemap with the canonical root URL. Update lastModified on meaningful content changes. */
export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: 'https://glyphshaper.com',
			lastModified: '2026-05-31',
			changeFrequency: 'monthly',
			priority: 1,
		},
	]
}
