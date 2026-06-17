import { useState, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BASE_URL } from '../services/api';

const DEV_LOGIN_ENABLED = import.meta.env.VITE_DEV_LOGIN_ENABLED === 'true';

export default function Login() {
  const [searchParams] = useSearchParams();
  const isUnauthorized = searchParams.get('error') === 'unauthorized';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [devError, setDevError] = useState('');
  const [devLoading, setDevLoading] = useState(false);

  async function handleDevLogin(e: FormEvent) {
    e.preventDefault();
    setDevError('');
    setDevLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/dev-login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setDevError((err as { error?: string }).error || 'Credenziali non valide');
        return;
      }
      window.location.href = '/';
    } catch {
      setDevError('Errore di rete');
    } finally {
      setDevLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <span className="text-white font-headline font-extrabold text-2xl">P</span>
          </div>
          <h1 className="font-headline font-extrabold text-2xl text-on-surface">Presence App</h1>
          <p className="text-sm text-on-surface-variant text-center">Gestisci la tua presenza in ufficio</p>
        </div>

        {isUnauthorized && (
          <div className="w-full rounded-xl bg-error/10 border border-error/20 px-4 py-3 text-sm text-error text-center">
            Accesso riservato agli utenti @dblue.it
          </div>
        )}

        <a
          href={`${BASE_URL}/auth/google`}
          className="w-full flex items-center justify-center gap-3 bg-surface-container border border-outline-variant rounded-xl px-4 py-3 font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Accedi con Google
        </a>

        {DEV_LOGIN_ENABLED && (
          <>
            <div className="w-full flex items-center gap-3">
              <div className="flex-1 h-px bg-outline-variant" />
              <span className="text-xs text-on-surface-variant">oppure</span>
              <div className="flex-1 h-px bg-outline-variant" />
            </div>

            <form onSubmit={handleDevLogin} className="w-full flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full text-sm px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full text-sm px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {devError && (
                <p className="text-xs text-error">{devError}</p>
              )}
              <button
                type="submit"
                disabled={devLoading}
                className="w-full text-sm font-medium py-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors disabled:opacity-50"
              >
                {devLoading ? 'Accesso…' : 'Accedi (dev)'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
