import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "./EditorLoginPage.css";

export default function EditorLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [project, setProject] = useState("democrats_abroad");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, teamName: "", contact: "", password }),
      });
      const data = await res.json() as { ok: boolean; isAdmin?: boolean; error?: string };
      if (data.ok && data.isAdmin) {
        login(project, "", "", true);
        navigate("/editor");
      } else if (data.ok && !data.isAdmin) {
        setError("These credentials do not have organiser access.");
      } else {
        setError(data.error || "Incorrect password.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="editor-login">
      <div className="editor-login__header">
        <div className="editor-login__eyebrow">Organiser tools</div>
        <div className="editor-login__headline">Sign in</div>
      </div>
      <form onSubmit={handleSubmit} className="editor-login__form">
        <div className="editor-login__field">
          <label className="editor-login__label">Project</label>
          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            required
            className="editor-login__input"
          />
        </div>
        <div
          className={
            error
              ? "editor-login__field--last-error"
              : "editor-login__field--last"
          }
        >
          <label className="editor-login__label">Admin password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={`editor-login__input${error ? " editor-login__input--error" : ""}`}
          />
        </div>
        {error ? <div className="editor-login__error">✕ {error}</div> : null}
        <button
          type="submit"
          disabled={loading}
          className={`editor-login__submit${loading ? " editor-login__submit--loading" : ""}`}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}