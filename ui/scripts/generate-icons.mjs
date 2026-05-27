import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import sharp from 'sharp'

const sizes = [192, 512]
const svg = readFileSync(resolve('public/icons/icon.svg'))
const out = resolve('public/icons')

mkdirSync(out, { recursive: true })

for (const size of sizes) {
	sharp(svg)
		.resize(size, size)
		.png()
		.toFile(resolve(out, `icon-${size}.png`))
		.then(() => console.log(`Generated ${size}x${size}`))
}
