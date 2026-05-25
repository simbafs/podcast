import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"

export default defineConfig({
	plugins: [react(), tailwindcss()],
	build: {
		outDir: "dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				login: resolve(__dirname, "login.html"),
			},
		},
	},
})
