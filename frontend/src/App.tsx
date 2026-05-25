import { getAccountId } from "./lib/storage"
import { Home } from "./pages/Home"

export function App() {
	if (!getAccountId()) {
		window.location.href = "/login"
		return null
	}

	return <Home />
}
