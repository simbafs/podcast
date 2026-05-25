'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/hooks/useTheme'

const icons: Record<ThemeMode, typeof Sun> = {
	system: Monitor,
	light: Sun,
	dark: Moon,
}

const labels: Record<ThemeMode, string> = {
	system: 'System theme',
	light: 'Light theme',
	dark: 'Dark theme',
}

const order: ThemeMode[] = ['system', 'light', 'dark']

export default function ThemeToggle() {
	const { mode, setMode } = useTheme()

	const cycle = () => {
		const idx = order.indexOf(mode)
		setMode(order[(idx + 1) % order.length])
	}

	const Icon = icons[mode]

	return (
		<button
			type="button"
			onClick={cycle}
			aria-label={`Theme: ${labels[mode]}. Click to switch.`}
			className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-teal-400"
		>
			<AnimatePresence mode="wait">
				<motion.div
					key={mode}
					initial={{ scale: 0, rotate: -90 }}
					animate={{ scale: 1, rotate: 0 }}
					exit={{ scale: 0, rotate: 90 }}
					transition={{ duration: 0.2 }}
				>
					<Icon className="h-4 w-4" aria-hidden="true" />
				</motion.div>
			</AnimatePresence>
		</button>
	)
}
