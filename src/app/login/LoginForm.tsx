'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = { error: null };

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form className="login-form" action={formAction} noValidate>
      <input type="hidden" name="next" value={next} />

      <div className="login-field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="e.g. r.kumar"
          required
          autoFocus
        />
      </div>

      <div className="login-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
        />
      </div>

      {state.error && (
        <div className="login-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      <button className="login-submit" type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <span className="login-spinner" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </>
        )}
      </button>

      <p className="login-footnote">
        Accounts are issued by the Super Admin. If you need access or a password reset,
        contact the store administration office.
      </p>
    </form>
  );
}
