import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./landing.module.scss";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [resetcode, setResetcode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await axios.put(`${API_URL}/auth/reset-password`, {
        email: email.trim(),
        password,
        resetcode: resetcode.trim(),
      });
      setDone(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.response?.data?.message || "Reset failed.");
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src="/dbluelogo.svg" alt="Deep Blue" width={36} height={30} />
          <span className={styles.logoText}>Deep Blue</span>
        </div>

        <h1 className={styles.title}>Set new password</h1>

        {done ? (
          <>
            <p className={styles.subtitle}>
              Your password has been reset successfully.
            </p>
            <button className={styles.button} onClick={() => navigate("/")}>
              Back to sign in
            </button>
          </>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              required
            />
            <input
              className={styles.input}
              type="text"
              value={resetcode}
              onChange={(e) => setResetcode(e.target.value)}
              placeholder="Reset code (from email)"
              autoComplete="one-time-code"
              required
            />
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              required
            />
            <input
              className={styles.input}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              required
            />
            {error && <p className={styles.error}>{error}</p>}
            <button
              className={styles.button}
              type="submit"
              disabled={loading || !email.trim() || !resetcode.trim() || !password || !confirm}
            >
              {loading ? "Resetting…" : "Set new password"}
            </button>
          </form>
        )}

        <button className={styles.forgotLink} onClick={() => navigate("/")}>
          ← Back to sign in
        </button>
      </div>
    </div>
  );
};

export default ResetPassword;
