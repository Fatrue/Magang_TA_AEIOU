import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { isMock } from "../api";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={(e) => void submit(e)}>
        <div className="brand-mark"><Icon name="leaf" size={24} /></div>
        <h1>Irigasi BRMP</h1>
        <p className="login-sub">Masuk untuk memantau dan mengontrol penyiraman.</p>
        <label className="field">Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field">Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <div className="banner bad">{error}</div>}
        <Button type="submit" className="primary-button" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</Button>
        {isMock && <p className="login-hint">Mode data tiruan. Coba <strong>admin / admin123</strong> (bisa kontrol) atau <strong>viewer / viewer123</strong> (hanya lihat).</p>}
      </form>
    </div>
  );
}