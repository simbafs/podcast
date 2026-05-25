import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { getAccountId } from "./lib/storage";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!getAccountId()) {
      navigate("/login");
    }
  }, [navigate]);
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/login"
        element={<Login />}
      />
    </Routes>
  );
}