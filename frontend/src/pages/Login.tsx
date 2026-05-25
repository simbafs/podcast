import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../hooks/useAccount";

export function Login() {
  const navigate = useNavigate();
  const { createAccount, joinAccount } = useAccount();
  const [joinId, setJoinId] = useState("");

  const handleCreate = () => {
    createAccount();
    navigate("/");
  };

  const handleJoin = () => {
    if (joinId.trim()) {
      joinAccount(joinId.trim());
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="card bg-base-200 w-96 shadow-xl">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl">Podcast Sync</h1>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreate}
          >
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
  );
}