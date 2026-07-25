'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../src/lib/supabase/client';
import { Button, Card } from '../../src/components/primitives';

/**
 * Staff-only login (dispatcher/technician/admin). Customers never see this —
 * the public request flow at app/request/page.tsx stays fully anonymous.
 * There is no public "sign up" here on purpose: staff accounts are created by
 * an admin directly in the Supabase dashboard (see supabase/auth_migration.sql),
 * the same way most internal ops tools work — this isn't a consumer product
 * people self-register for.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (signInError) {
      setError('Could not sign in — check your email and password and try again.');
      return;
    }

    router.push('/dispatch');
  }

  return (
    <main className="byk-request-page">
      <div className="byk-request-header">
        <span className="byk-topbar__brand-mark" aria-hidden="true" />
        <h1>Staff sign in</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="byk-request-form">
          <div className="byk-form-field">
            <label className="byk-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="byk-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="byk-form-field">
            <label className="byk-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="byk-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="byk-form-error" role="alert">{error}</p>}

          <Button type="submit" size="lg" loading={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
