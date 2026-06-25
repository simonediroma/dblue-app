import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import axios from "axios";
import { useAuth } from "../../contexts/authContext";
import type { AuthUser } from "../../contexts/authContext";
import styles from "./landing.module.scss";

const Landing = () => {
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;

  const onGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post<{ success: boolean; user: AuthUser }>(
        `${API_URL}/auth/google`,
        { credential: credentialResponse.credential },
        { withCredentials: true }
      );
      setSession(res.data.user);
      navigate("/home");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Google sign-in failed.");
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post<{ success: boolean; user: AuthUser }>(
        `${API_URL}/auth/email`,
        { email: email.trim(), password },
        { withCredentials: true }
      );
      setSession(res.data.user);
      navigate("/home");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Invalid credentials.");
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

        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Access the booking application.</p>

        {/* Google sign-in — @dblue.it accounts only */}
        <div className={styles.googleWrapper}>
          <GoogleLogin
            onSuccess={onGoogleSuccess}
            onError={() => setError("Google sign-in failed.")}
            hosted_domain="dblue.it"
            text="signin_with"
            shape="rectangular"
            width={300}
          />
        </div>

        <div className={styles.divider}>
          <span>or sign in with email</span>
        </div>

        {/* Email / password sign-in — for non-@dblue.it accounts */}
        <form className={styles.form} onSubmit={handleEmailLogin}>
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
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
          />
          {error && <p className={styles.error}>{error}</p>}
          <button
            className={styles.button}
            type="submit"
            disabled={loading || !email.trim() || !password}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <button
          className={styles.forgotLink}
          onClick={() => navigate("/forget/password")}
        >
          Forgot your password?
        </button>
      </div>
    </div>
  );
};

export default Landing;
