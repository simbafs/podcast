import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import PwaRegister from '@/components/PwaRegister'

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
})

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
})

export const metadata: Metadata = {
	title: 'Podcast Player',
	description: 'Sync podcast progress across devices',
	manifest: '/manifest.json',
}

export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#ffffff' },
		{ media: '(prefers-color-scheme: dark)', color: '#09090b' },
	],
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			suppressHydrationWarning
		>
			<body className="flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var e=localStorage.getItem('theme')||'system',d=e==='dark'||e==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`,
					}}
				/>
				{children}
				<PwaRegister />
			</body>
		</html>
	)
}
