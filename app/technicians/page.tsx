'use client';

import { useEffect, useRef, useState } from 'react';
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
  | { status: 'authorized'; userId: string; fullName: string };

/**
 * Auth boundary: this page only loads a technician's own jobs once a
 * session AND a matching public.profiles row (role = 'technician') are
 * confirmed. The UI redirect below is a convenience — the actual security
 * boundary is the "technician_can_read_own_jobs" RLS policy in
 * supabase/technician_migration.sql, which Postgres enforces regardless of
 * what this component does (it only ever returns rows where
 * technician_id = the signed-in user, no matter what this page requests).
 */
export default function TechniciansPage() {
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
      } else if (profile.role === 'dispatcher' || profile.role === 'admin') {
        setAuth({ status: 'wrong_role' });
      } else {
        setAuth({ status: 'authorized', userId: session.user.id, fullName: profile.full_name });
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
    if (auth.status === 'wrong_role') router.push('/dispatch');
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
            account yet, so your job list is intentionally hidden — ask a dispatcher to add a row for you to{' '}
            <code>public.profiles</code> with role <code>technician</code> (see the "ONE-TIME SETUP" note at
            the bottom of <code>supabase/technician_migration.sql</code>).
          </p>
          <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
        </Card>
      </main>
    );
  }

  return (
    <AuthorizedTechnicianQueue userId={auth.userId} fullName={auth.fullName} onSignOut={handleSignOut} />
  );
}

function AuthorizedTechnicianQueue({
  userId,
  fullName,
  onSignOut,
}: {
  userId: string;
  fullName: string;
  onSignOut: () => void;
}) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'subscribed' | 'error'>('connecting');
  const rowsRef = useRef<Map<string, JobRow>>(new Map());

  function pushToState() {
    const items = Array.from(rowsRef.current.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setJobs(items);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('technician_id', userId)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        setRealtimeStatus('error');
        return;
      }
      rowsRef.current = new Map((data as JobRow[]).map((r) => [r.id, r]));
      pushToState();
    }

    loadInitial();

    // Filtered to this technician's own jobs only — the same protection
    // also holds server-side via RLS even if this filter were ever removed.
    const channel = supabase
      .channel('jobs-technician-own-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `technician_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            rowsRef.current.delete((payload.old as JobRow).id);
          } else {
            const row = payload.new as JobRow;
            rowsRef.current.set(row.id, row);
          }
          pushToState();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('subscribed');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error');
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <AppShell
      topBar={<TopBar role="technician" userName={fullName} />}
      sideNav={
        <SideNav
          activeHref="/technicians"
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <h1 className="byk-demo-section__title" style={{ margin: 0 }}>My Jobs</h1>
          <Badge tone={realtimeStatus === 'subscribed' ? 'success' : realtimeStatus === 'error' ? 'danger' : 'warning'}>
            {realtimeStatus === 'subscribed' ? 'Realtime connected' : realtimeStatus === 'error' ? 'Realtime error' : 'Connecting…'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onSignOut} style={{ marginLeft: 'auto' }}>
            Sign out
          </Button>
        </div>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 'var(--space-6)' }}>
          Jobs a dispatcher assigns to you appear here instantly — no refresh needed.
        </p>

        {jobs.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
              No jobs assigned to you yet. New assignments will appear here automatically.
            </p>
          </Card>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 0, margin: 0 }}>
            {jobs.map((job) => (
              <li key={job.id}>
                <TechnicianJobCard job={job} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

// Which status a technician can move a job to next, and what the button
// says. Matches the "en_route/arrived/in_progress/completed" values the
// technician_can_update_own_job_status RLS policy allows — anything not
// listed here (matched, requested, completed, cancelled) has no button,
// since that's either not reached yet or a terminal/dispatcher-only state.
const NEXT_STATUS: Partial<Record<JobRow['status'], { next: JobRow['status']; label: string }>> = {
  matched: { next: 'en_route', label: 'Start driving' },
  en_route: { next: 'arrived', label: 'Mark arrived' },
  arrived: { next: 'in_progress', label: 'Start job' },
  in_progress: { next: 'completed', label: 'Mark complete' },
};

function TechnicianJobCard({ job }: { job: JobRow }) {
  const priorityTone = job.priority === 'emergency' ? 'danger' : job.priority === 'fleet_contract' ? 'info' : 'neutral';
  const statusTone = job.status === 'completed' ? 'success' : job.status === 'cancelled' ? 'neutral' : 'warning';
  const slaTime = new Date(job.sla_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const mapsUrl = `https://www.google.com/maps?q=${job.lat},${job.lng}`;
  const advance = NEXT_STATUS[job.status];
  const [updating, setUpdating] = useState(false);

  async function handleAdvance() {
    if (!advance) return;
    setUpdating(true);
    const { error } = await supabase.from('jobs').update({ status: advance.next }).eq('id', job.id);
    // No manual local-state update needed on success — the Realtime
    // subscription above receives this same write back and refreshes the
    // card automatically, same as a dispatcher's change would.
    if (error) setUpdating(false);
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        <Badge tone={priorityTone}>{job.priority.replace('_', ' ')}</Badge>
        <Badge tone={statusTone}>{job.status.replace('_', ' ')}</Badge>
      </div>
      <h3 className="byk-incident-card__title" style={{ margin: '0 0 var(--space-2) 0' }}>
        {job.service_category.replace('_', ' ')}
      </h3>
      <p style={{ margin: '0 0 var(--space-1) 0', color: 'var(--color-text-muted)' }}>
        {job.customer_name} ·{' '}
        <a href={`tel:${job.customer_phone}`} style={{ color: 'inherit' }}>{job.customer_phone}</a>
        {' '}· {job.vehicle_type.toUpperCase()}
      </p>
      <p style={{ margin: '0 0 var(--space-1) 0', color: 'var(--color-text-muted)' }}>
        SLA by {slaTime} ·{' '}
        <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          Open in Maps
        </a>
      </p>
      {job.notes && (
        <p style={{ margin: 'var(--space-2) 0 0 0', color: 'var(--color-text-muted)' }}>{job.notes}</p>
      )}
      {advance && (
        <Button
          variant="primary"
          size="sm"
          loading={updating}
          disabled={updating}
          style={{ marginTop: 'var(--space-3)' }}
          onClick={handleAdvance}
        >
          {advance.label}
        </Button>
      )}
    </Card>

  );
}
