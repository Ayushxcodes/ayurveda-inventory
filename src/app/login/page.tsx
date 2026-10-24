import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import LoginForm from './LoginForm';
import './login.css';

export const metadata: Metadata = {
  title: 'Sign in — AyurVaidya',
  description: 'Secure access to the AyurVaidya inventory system',
};

function safeNext(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const user = await getSessionUser();
  if (user) redirect(next);

  return (
    <main className="login-page">
      <section className="login-brand" aria-label="About AyurVaidya">
        <div className="login-brand-glow" aria-hidden="true" />
        <div className="login-brand-top">
          <div className="login-emblem" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C6.477 2 2 6.477 2 12c0 3.2 1.5 6.05 3.828 7.89.47.37.98.69 1.52.95C8.84 21.57 10.37 22 12 22s3.16-.43 4.652-1.16c.54-.26 1.05-.58 1.52-.95C20.5 18.05 22 15.2 22 12c0-5.523-4.477-10-10-10z"
                fill="currentColor"
                fillOpacity="0.15"
              />
              <path
                d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 2.43.867 4.656 2.316 6.388L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M12 12c1.8-3.2 4.4-4.8 7.2-4.8 0 3-1.8 5.6-5 7.2" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 12c-1.8 3.2-4.4 4.8-7.2 4.8 0-3 1.8-5.6 5-7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="login-brand-name">
              AyurVaidya<span className="login-brand-dot" />
            </div>
            <div className="login-brand-sub">All India Institute of Ayurveda · Faridabad</div>
          </div>
        </div>

        <div className="login-brand-copy">
          <div className="login-kicker">Ministry of AYUSH · Inventory ERP</div>
          <h1>
            Every dravya accounted for,
            <br />
            every movement traceable.
          </h1>
          <p>
            A unified register for CAPEX assets and OPEX consumables — from stock
            inward and batch tracking to department issues and expiry control.
          </p>

          <ul className="login-features">
            <li>
              <span className="login-feature-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <div>
                <strong>Role-based access</strong>
                <span>Super Admin, Admin, Procurement, HOD and Requester each see only what they should.</span>
              </div>
            </li>
            <li>
              <span className="login-feature-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M5 21V7l7-4 7 4v14" />
                  <path d="M9 21v-5h6v5M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
                </svg>
              </span>
              <div>
                <strong>Department-scoped visibility</strong>
                <span>HODs track consumption, wastage and issue history for their own department.</span>
              </div>
            </li>
            <li>
              <span className="login-feature-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 118 0v3M12 14v2" />
                </svg>
              </span>
              <div>
                <strong>Audited sessions</strong>
                <span>Every sign-in and stock action is recorded against a named user.</span>
              </div>
            </li>
          </ul>
        </div>

        <div className="login-brand-footer">
          <span>AIIA · MoA AYUSH ERP</span>
          <span className="login-brand-sep" />
          <span>Faridabad Campus</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-eyebrow">
            <span className="login-eyebrow-dot" />
            Secure access
          </div>
          <h2>Sign in to AyurVaidya</h2>
          <p className="login-subtitle">Use the credentials issued by your Super Admin.</p>
          <LoginForm next={next} />
        </div>
        <div className="login-panel-footer">
          <span>Authorised personnel only.</span>
          <span className="login-panel-dot" />
          <span>AYUSH verified</span>
        </div>
      </section>
    </main>
  );
}
