'use client';

import { useEffect, useRef, useState, useActionState } from 'react';
import { createPortal } from 'react-dom';
import { changePasswordAction, logoutAction, type ChangePasswordState } from '@/app/actions/account';
import { clearClientCache } from '@/lib/client-cache';
import { ROLE_LABELS, userInitials, type SessionUser } from '@/lib/auth/roles';
import './account-menu.css';

const initialPasswordState: ChangePasswordState = { error: null, success: false };

function clearSessionArtifacts() {
  try {
    sessionStorage.removeItem('openItemForISS');
    sessionStorage.removeItem('openItemForISSBatch');
    sessionStorage.removeItem('openItemForGRN');
    sessionStorage.removeItem('registryDeepLink');
  } catch {}
  clearClientCache();
}

export default function AccountMenu({ user }: { user: SessionUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!passwordOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPasswordOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [passwordOpen]);

  const roleLabel = ROLE_LABELS[user.role];

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="user-card account-trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <div className="avatar-wrapper">
          <div className="avatar">{userInitials(user.fullName)}</div>
          <span className="avatar-dot" />
        </div>
        <div className="user-info">
          <div className="user-name">{user.fullName}</div>
          <div className="user-role">{roleLabel}</div>
          <div className="user-badge">● Online · {user.deptName ?? 'AYUSH Verified'}</div>
        </div>
        <svg
          className={`account-caret ${menuOpen ? 'open' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 10l4-4 4 4M8 14l4 4 4-4" />
        </svg>
      </button>

      {menuOpen && (
        <div className="account-popover" role="menu">
          <div className="account-popover-head">
            <div className="account-popover-name">{user.fullName}</div>
            <div className="account-popover-meta">@{user.username}</div>
            <div className="account-popover-tags">
              <span className="account-role-tag">{roleLabel}</span>
              {user.deptName && <span className="account-dept-tag">{user.deptName}</span>}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            className="account-action"
            onClick={() => {
              setMenuOpen(false);
              setPasswordOpen(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 118 0v3" />
            </svg>
            Change password
          </button>

          <div className="account-divider" />

          <form action={logoutAction} className="account-logout-form">
            <button type="submit" role="menuitem" className="account-action danger" onClick={clearSessionArtifacts}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <path d="M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      )}

      {passwordOpen &&
        createPortal(
          <div
            className="account-modal-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPasswordOpen(false);
            }}
          >
            <div className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
              <div className="account-modal-head">
                <div>
                  <div className="account-modal-eyebrow">Account security</div>
                  <h3 id="account-modal-title">Change password</h3>
                </div>
                <button
                  type="button"
                  className="account-modal-close"
                  aria-label="Close"
                  onClick={() => setPasswordOpen(false)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <ChangePasswordForm onClose={() => setPasswordOpen(false)} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialPasswordState);

  if (state.success) {
    return (
      <div className="account-password-success">
        <div className="account-success-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p>Your password has been updated. Other sessions signed out automatically.</p>
        <button type="button" className="account-btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form className="account-password-form" action={formAction} noValidate>
      <div className="account-field">
        <label htmlFor="currentPassword">Current password</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="account-field">
        <label htmlFor="newPassword">New password</label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
        <span className="account-field-hint">At least 8 characters.</span>
      </div>
      <div className="account-field">
        <label htmlFor="confirmPassword">Confirm new password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
      </div>

      {state.error && (
        <div className="account-form-error" role="alert">
          {state.error}
        </div>
      )}

      <div className="account-modal-actions">
        <button type="button" className="account-btn ghost" onClick={onClose} disabled={isPending}>
          Cancel
        </button>
        <button type="submit" className="account-btn primary" disabled={isPending}>
          {isPending ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}
