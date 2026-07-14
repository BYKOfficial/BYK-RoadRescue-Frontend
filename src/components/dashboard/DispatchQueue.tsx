import { useMemo, useState } from 'react';
import { useIncidentQueue, useStore } from '../../store';
import { IncidentCard } from './IncidentAndHelperCards';

/**
 * Sorted by time-to-breach, not FIFO — a 2-minute-old emergency must outrank
 * a 10-minute-old flat tire. Emergency priority always floats to the very
 * top regardless of remaining SLA time, since those bypass the normal queue
 * per the customer journey spec (2.1).
 */
export function DispatchQueue({ onAssign }: { onAssign: (jobId: string) => void }) {
  const incidents = useIncidentQueue();
  const selectedIncidentId = useStore((s) => s.selectedIncidentId);
  const selectIncident = useStore((s) => s.selectIncident);
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'emergency'>('all');

  const sorted = useMemo(() => {
    const filtered = incidents.filter((i) => {
      if (filter === 'unassigned') return i.status === 'unassigned';
      if (filter === 'emergency') return i.priority === 'emergency';
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
      if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
      return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
    });
  }, [incidents, filter]);

  return (
    <section aria-label="Incident dispatch queue" className="byk-dispatch-queue">
      <div className="byk-dispatch-queue__filters" role="tablist" aria-label="Filter incidents">
        {(['all', 'unassigned', 'emergency'] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`byk-filter-tab ${filter === f ? 'byk-filter-tab--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'unassigned' ? 'Unassigned' : 'Emergency'}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="byk-empty-state" role="status">
          <p>No incidents match this filter.</p>
        </div>
      ) : (
        <ul className="byk-dispatch-queue__list">
          {sorted.map((incident) => (
            <li key={incident.jobId}>
              <IncidentCard
                incident={incident}
                onAssign={onAssign}
                onSelect={selectIncident}
                isSelected={selectedIncidentId === incident.jobId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* Companion CSS:
.byk-dispatch-queue__filters { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
.byk-filter-tab { background: var(--color-bg-surface); border: 1px solid var(--color-border-hairline); color: var(--color-text-muted); padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); font-size: var(--type-body-sm-size); font-weight: 600; cursor: pointer; }
.byk-filter-tab--active { background: var(--color-brand-primary); color: #0e1522; border-color: var(--color-brand-primary); }
.byk-filter-tab:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.byk-dispatch-queue__list { list-style: none; display: flex; flex-direction: column; gap: var(--space-3); }
.byk-empty-state { text-align: center; padding: var(--space-9); color: var(--color-text-muted); border: 1px dashed var(--color-border-hairline); border-radius: var(--radius-md); }
*/
