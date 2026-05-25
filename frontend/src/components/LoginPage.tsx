import { useState } from "react"
import { setAccountId } from "../lib/storage"

export function LoginPage() {
	const [joinId, setJoinId] = useState("")

	const handleCreate = () => {
		const id = "acc-" + crypto.randomUUID().slice(0, 8)
		setAccountId(id)
		window.location.href = "/"
	}

	const handleJoin = () => {
		if (joinId.trim()) {
			setAccountId(joinId.trim())
			window.location.href = "/"
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-base-100">
			<div className="card bg-base-200 w-96 shadow-xl">
				<div className="card-body gap-4">
					<h1 className="card-title text-2xl">Podcast Sync</h1>

					<button type="button" className="btn btn-primary" onClick={handleCreate}>
						Create New Account
					</button>

					<div className="divider">or</div>

					<input
						type="text"
						className="input input-bordered"
						placeholder="Account ID"
						value={joinId}
						onChange={(e) => setJoinId(e.target.value)}
					/>
					<button
						type="button"
						className="btn btn-secondary"
						disabled={!joinId.trim()}
						onClick={handleJoin}
					>
						Join Account
					</button>
				</div>
			</div>
		</div>
	)
}
