import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./landing.module.scss";

const ForgetPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Request failed.");
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

        <h1 className={styles.title}>Reset password</h1>

        {submitted ? (
          <>
            <p className={styles.subtitle}>
              If an account exists for <strong>{email}</strong>, a reset code has been sent.
              Check your inbox and follow the instructions.
            </p>
            <button className={styles.button} onClick={() => navigate("/reset/password")}>
              Enter reset code
            </button>
          </>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <p className={styles.subtitle}>
              Enter your email address and we will send you a reset code.
            </p>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              required
            />
            {error && <p className={styles.error}>{error}</p>}
            <button
              className={styles.button}
              type="submit"
              disabled={loading || !email.trim()}
            >
              {loading ? "Sending…" : "Send reset code"}
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

export default ForgetPassword;
