import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, relative } from 'path'

const outDir = resolve('out')

function walk(dir) {
	const entries = readdirSync(join(outDir, dir))
	const files = []
	for (const entry of entries) {
		const full = join(outDir, dir, entry)
		const rel = join(dir, entry)
		if (statSync(full).isDirectory()) {
			files.push(...walk(rel))
		} else {
			files.push('/' + rel.replace(/\\/g, '/'))
		}
	}
	return files
}

const allFiles = walk('.')
const swPath = resolve(outDir, 'sw.js')

const sw = `const CACHE = 'podcast-v1'
const PRECACHE = ${JSON.stringify(allFiles)}

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
	)
})

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(keys =>
			Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))),
		).then(() => self.clients.claim()),
	)
})

self.addEventListener('fetch', event => {
	const { request } = event
	const url = new URL(request.url)

	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(() => caches.match(request).then(r => r || caches.match('/player'))),
		)
		return
	}

	if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
		event.respondWith(
			caches.match(request).then(cached => cached || fetch(request).then(res => {
				const clone = res.clone()
				caches.open(CACHE).then(cache => cache.put(request, clone))
				return res
			})),
		)
		return
	}

	event.respondWith(
		fetch(request).catch(() => caches.match(request)),
	)
})`

writeFileSync(swPath, sw)
console.log(`Generated ${swPath} with ${allFiles.length} precached files`)
