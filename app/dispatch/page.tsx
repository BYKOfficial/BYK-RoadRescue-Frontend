'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { AppShell, TopBar, SideNav } from '../../src/components/layout/AppShell';
import { DispatchQueue } from '../../src/components/dashboard/DispatchQueue';
import { useStore } from '../../src/store';
import { supabase } from '../../src/lib/supabase/client';
import type { JobRow } from '../../src/lib/supabase/types';
import type { IncidentQueueItem } from '../../src/store/slices/ops';
import { Badge, Button, Card } from '../../src/components/primitives';

const OPEN_STATUSES: JobRow['status'][] = ['requested', 'matched', 'en_route', 'arrived', 'in_progress'];

function toIncidentQueueItem(row: JobRow): IncidentQueueItem {
  return {
    jobId: row.id,
    serviceCategory: row.service_category,
    customerName: row.customer_name,
    createdAt: row.created_at,
    slaDeadline: row.sla_deadline,
    status: row.status === 'requested' ? 'unassigned' : 'assigned',
    priority: row.priority,
  };
}

type AuthState =
  | { status: 'checking' }
  | { status: 'signed_out' }
  | { status: 'no_profile'; email: string }
  | { status: 'authorized'; email: string; fullName: string };

/**
 * Auth boundary: this page only loads real job data once a session AND a
 * matching public.profiles row are confirmed. The UI redirect below is a
 * convenience — the actual security boundary is the RLS policy in
 * supabase/auth_migration.sql ("staff_can_read_jobs"), which Postgres
 * enforces regardless of what this component does. Even if someone bypassed
 * this redirect entirely, an unauthenticated request still gets nothing back.
 */
export default function DispatchPage() {
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
        .select('full_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!profile) {
        setAuth({ status: 'no_profile', email: session.user.email ?? '' });
      } else {
        setAuth({ status: 'authorized', email: session.user.email ?? '', fullName: profile.full_name });
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
  }, [auth.status, router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (auth.status === 'checking' || auth.status === 'signed_out') {
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
            account yet, so the dispatch queue is intentionally hidden — see the "ONE-TIME SETUP" note at the
            bottom of <code>supabase/auth_migration.sql</code> to link this account to a dispatcher role.
          </p>
          <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
        </Card>
      </main>
    );
  }

  return (
    <AuthorizedDispatchQueue fullName={auth.fullName} onSignOut={handleSignOut} />
  );
}

function AuthorizedDispatchQueue({ fullName, onSignOut }: { fullName: string; onSignOut: () => void }) {
  const setIncidentQueue = useStore((s) => s.setIncidentQueue);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'subscribed' | 'error'>('connecting');
  const rowsRef = useRef<Map<string, JobRow>>(new Map());

  function pushToStore() {
    const items = Array.from(rowsRef.current.values())
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(toIncidentQueueItem);
    setIncidentQueue(items);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .in('status', OPEN_STATUSES)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        setRealtimeStatus('error');
        return;
      }
      rowsRef.current = new Map((data as JobRow[]).map((r) => [r.id, r]));
      pushToStore();
    }

    loadInitial();

    const channel = supabase
      .channel('jobs-dispatch-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          rowsRef.current.delete((payload.old as JobRow).id);
        } else {
          const row = payload.new as JobRow;
          if (OPEN_STATUSES.includes(row.status)) {
            rowsRef.current.set(row.id, row);
          } else {
            rowsRef.current.delete(row.id); // completed/cancelled — drop off the active queue
          }
        }
        pushToStore();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('subscribed');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error');
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAssign(jobId: string) {
    // Simplified stand-in for real matching (see 01-ARCHITECTURE.md Phase 2):
    // no technician records or scoring exist yet, so this just demonstrates
    // the real write-back path — the queue updates the instant this commits,
    // via the same Realtime subscription, for every dispatcher watching it.
    await supabase
      .from('jobs')
      .update({ status: 'matched', technician_name: 'Assigned Technician (demo)' })
      .eq('id', jobId);
  }

  return (
    <AppShell
      topBar={<TopBar role="dispatcher" userName={fullName} />}
      sideNav={
        <SideNav
          activeHref="/dispatch"
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
          <h1 className="byk-demo-section__title" style={{ margin: 0 }}>Live Dispatch Queue</h1>
          <Badge tone={realtimeStatus === 'subscribed' ? 'success' : realtimeStatus === 'error' ? 'danger' : 'warning'}>
            {realtimeStatus === 'subscribed' ? 'Realtime connected' : realtimeStatus === 'error' ? 'Realtime error' : 'Connecting…'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onSignOut} style={{ marginLeft: 'auto' }}>
            Sign out
          </Button>
        </div>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 'var(--space-6)' }}>
          New requests submitted at <code>/request</code> appear here instantly — no refresh needed.
        </p>
        <DispatchQueue onAssign={handleAssign} />
      </div>
    </AppShell>
  );
}
