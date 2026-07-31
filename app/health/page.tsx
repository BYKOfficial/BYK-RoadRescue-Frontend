'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { AppShell, TopBar, SideNav } from '../../src/components/layout/AppShell';
import { supabase } from '../../src/lib/supabase/client';
import type { JobRow } from '../../src/lib/supabase/types';
import { Badge, Button, Card } from '../../src/components/primitives';

type AuthState =
  | { status: 'checking' }
  | { status: 'signed_out' }
  | { status: 'wrong_role' }
  | { status: 'no_profile'; email: string }
  | { status: 'authorized'; fullName: string };

const OPEN_STATUSES: JobRow['status'][] = ['requested', 'matched', 'en_route', 'arrived', 'in_progress'];

/**
 * Deliberately NOT reusing TechStackPanel/RealtimeHealthPanel from
 * PanelsAndKPI.tsx: those read from the shared connection store, which
 * app/page.tsx only ever fills with hardcoded demo numbers (see its
 * setServiceHealth('postgres', { status: 'healthy', latencyMs: 12 })
 * calls etc). A health page showing fabricated numbers is worse than no
 * health page — everything below is a real, live check with its own
 * local state, run fresh on this page every time.
 */
export default function HealthPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;

    async function checkAuth(session: Session | null) {
      if (!session) {
        if (!cancelled) setAuth({ status: 'signed_out' });
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!profile) {
        setAuth({ status: 'no_profile', email: session.user.email ?? '' });
      } else if (profile.role === 'technician') {
        setAuth({ status: 'wrong_role' });
      } else {
        setAuth({ status: 'authorized', fullName: profile.full_name });
      }
    }

    supabase.auth.getSession().then(({ data }) => checkAuth(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => checkAuth(session));

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (auth.status === 'signed_out') router.push('/login');
    if (auth.status === 'wrong_role') router.push('/technicians');
  }, [auth.status, router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (auth.status === 'checking' || auth.status === 'signed_out' || auth.status === 'wrong_role') {
    return (
      <main className="byk-request-page">
        <p style={{ color: 'var(--color-text-muted)' }}>Checking sign-in status…</p>
      </main>
    );
  }

  if (auth.status === 'no_profile') {
    return (
      <main className="byk-request-page">
        <Card>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--type-display-md-size)' }}>
            Signed in, but not authorized yet
          </h1>
          <p>
            You're signed in as <strong>{auth.email}</strong>, but there's no staff profile linked to this
            account yet. Ask a dispatcher to add a row for you to <code>public.profiles</code>.
          </p>
          <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
        </Card>
      </main>
    );
  }

  return <AuthorizedHealthPage fullName={auth.fullName} onSignOut={handleSignOut} />;
}

type CheckStatus = 'checking' | 'healthy' | 'degraded' | 'down';
interface ServiceCheck {
  status: CheckStatus;
  latencyMs: number | null;
  message?: string;
}
const PENDING: ServiceCheck = { status: 'checking', latencyMs: null };

function AuthorizedHealthPage({ fullName, onSignOut }: { fullName: string; onSignOut: () => void }) {
  const [db, setDb] = useState<ServiceCheck>(PENDING);
  const [realtime, setRealtime] = useState<ServiceCheck>(PENDING);
  const [authCheck, setAuthCheck] = useState<ServiceCheck>(PENDING);
  const [snapshot, setSnapshot] = useState<{ active: number; overdue: number } | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [running, setRunning] = useState(false);

  async function runChecks() {
    setRunning(true);

    // 1. Database — a real, cheap round trip (HEAD request, no rows
    // transferred) so latency reflects genuine connection + query time.
    const dbStart = performance.now();
    const { error: dbError } = await supabase.from('jobs').select('id', { count: 'exact', head: true });
    const dbLatency = Math.round(performance.now() - dbStart);
    setDb(
      dbError
        ? { status: 'down', latencyMs: null, message: dbError.message }
        : { status: dbLatency > 1500 ? 'degraded' : 'healthy', latencyMs: dbLatency }
    );

    // 2. Auth — confirms the session/auth client is actually responding.
    const authStart = performance.now();
    const { error: authError } = await supabase.auth.getSession();
    const authLatency = Math.round(performance.now() - authStart);
    setAuthCheck(
      authError
        ? { status: 'down', latencyMs: null, message: authError.message }
        : { status: authLatency > 1500 ? 'degraded' : 'healthy', latencyMs: authLatency }
    );

    // 3. Realtime — actually opens a channel and waits for a real
    // SUBSCRIBED/error event, same mechanism /dispatch and /technicians
    // depend on for live updates. A 5s cap avoids hanging forever if the
    // socket never responds.
    const rtStart = performance.now();
    await new Promise<void>((resolve) => {
      let settled = false;
      const channel = supabase.channel(`health-check-${Date.now()}`).subscribe((status) => {
        if (settled) return;
        if (status === 'SUBSCRIBED') {
          settled = true;
          setRealtime({ status: 'healthy', latencyMs: Math.round(performance.now() - rtStart) });
          supabase.removeChannel(channel);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          settled = true;
          setRealtime({ status: 'down', latencyMs: null, message: status });
          supabase.removeChannel(channel);
          resolve();
        }
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        setRealtime({ status: 'degraded', latencyMs: null, message: 'No response within 5s' });
        supabase.removeChannel(channel);
        resolve();
      }, 5000);
    });

    // 4. Real operational snapshot (not a "service" — just genuinely
    // useful, cheap to compute from the same jobs table).
    const { count: activeCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', OPEN_STATUSES);
    const { count: overdueCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', OPEN_STATUSES)
      .lt('sla_deadline', new Date().toISOString());
    setSnapshot({ active: activeCount ?? 0, overdue: overdueCount ?? 0 });

    setLastCheckedAt(new Date());
    setRunning(false);
  }

  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell
      topBar={<TopBar role="dispatcher" userName={fullName} />}
      sideNav={
        <SideNav
          activeHref="/health"
          items={[
            { label: 'Overview', href: '/', icon: '\u25A6' },
            { label: 'Dispatch', href: '/dispatch', icon: '\u2691' },
            { label: 'Technicians', href: '/technicians', icon: '\u2699' },
            { label: 'Health', href: '/health', icon: '\u2665' },
          ]}
        />
      }
    >
      <div className="byk-demo-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <h1 className="byk-demo-section__title" style={{ margin: 0 }}>System Health</h1>
          <Button variant="ghost" size="sm" onClick={onSignOut} style={{ marginLeft: 'auto' }}>Sign out</Button>
        </div>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
          Live checks against the real systems this app depends on — nothing here is demo data.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-caption-size)' }}>
            {lastCheckedAt ? `Last checked ${lastCheckedAt.toLocaleTimeString()}` : 'Checking…'} · auto-refreshes every 30s
          </span>
          <Button variant="secondary" size="sm" loading={running} disabled={running} onClick={runChecks}>
            Check now
          </Button>
        </div>

        <Card>
          <h2 className="byk-panel-title">Backend services</h2>
          <ul className="byk-tech-stack__list">
            <ServiceRow label="Database (Supabase Postgres)" check={db} />
            <ServiceRow label="Realtime (live updates)" check={realtime} />
            <ServiceRow label="Auth" check={authCheck} />
          </ul>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-caption-size)', marginTop: 'var(--space-4)', marginBottom: 0 }}>
            Payments, WhatsApp/SMS, and the other services in 01-ARCHITECTURE.md's full design aren't built yet,
            so they're left off this list rather than shown as a fake "healthy".
          </p>
        </Card>

        <Card style={{ marginTop: 'var(--space-4)' }}>
          <h2 className="byk-panel-title">Right now</h2>
          {snapshot ? (
            <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
              <div>
                <div style={{ fontSize: 'var(--type-caption-size)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Active jobs
                </div>
                <div style={{ fontSize: 'var(--type-display-md-size)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  {snapshot.active}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--type-caption-size)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Overdue on SLA
                </div>
                <div
                  style={{
                    fontSize: 'var(--type-display-md-size)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    color: snapshot.overdue > 0 ? 'var(--color-status-danger)' : undefined,
                  }}
                >
                  {snapshot.overdue}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Loading…</p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function ServiceRow({ label, check }: { label: string; check: ServiceCheck }) {
  const tone =
    check.status === 'checking' ? 'neutral' : check.status === 'healthy' ? 'success' : check.status === 'degraded' ? 'warning' : 'danger';
  return (
    <li className="byk-tech-stack__row" title={check.message}>
      <span className={`byk-conn-dot byk-conn-dot--${tone}`} aria-hidden="true" />
      <span className="byk-tech-stack__name">{label}</span>
      <span className="byk-tech-stack__latency">{check.latencyMs != null ? `${check.latencyMs}ms` : '—'}</span>
      <Badge tone={tone}>{check.status}</Badge>
    </li>
  );
}
