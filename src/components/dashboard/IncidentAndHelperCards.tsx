import { Badge, Card, Button } from '../primitives';
import { SLAWidget } from './SLAWidget';
import type { IncidentQueueItem, HelperSummary } from '../../store/slices/ops';

/* ---------------------------- IncidentCard ---------------------------- */

interface IncidentCardProps {
  incident: IncidentQueueItem;
  onAssign: (jobId: string) => void;
  onSelect: (jobId: string) => void;
  isSelected?: boolean;
}

export function IncidentCard({ incident, onAssign, onSelect, isSelected }: IncidentCardProps) {
  const priorityTone =
    incident.priority === 'emergency' ? 'danger' : incident.priority === 'fleet_contract' ? 'info' : 'neutral';

  return (
    <Card
      className={`byk-incident-card ${isSelected ? 'byk-incident-card--selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(incident.jobId)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(incident.jobId)}
      aria-pressed={isSelected}
    >
      <div className="byk-incident-card__header">
        <div>
          <Badge tone={priorityTone}>{incident.priority.replace('_', ' ')}</Badge>
          <h3 className="byk-incident-card__title">{incident.serviceCategory.replace('_', ' ')}</h3>
          <p className="byk-incident-card__customer">{incident.customerName}</p>
        </div>
        <SLAWidget slaDeadline={incident.slaDeadline} size={48} />
      </div>
      <div className="byk-incident-card__footer">
        <Badge tone={incident.status === 'unassigned' ? 'warning' : 'neutral'}>
          {incident.status.replace('_', ' ')}
        </Badge>
        {incident.status === 'unassigned' && (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAssign(incident.jobId);
            }}
          >
            Auto-assign nearest
          </Button>
        )}
      </div>
    </Card>
  );
}

/* Companion CSS:
.byk-incident-card { cursor: pointer; transition: border-color var(--motion-duration-fast); }
.byk-incident-card:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.byk-incident-card--selected { border-color: var(--color-brand-primary); }
.byk-incident-card__header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); }
.byk-incident-card__title { font-family: var(--font-display); font-size: var(--type-display-md-size); text-transform: capitalize; margin-top: var(--space-1); }
.byk-incident-card__customer { color: var(--color-text-muted); font-size: var(--type-body-sm-size); }
.byk-incident-card__footer { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-4); }
*/

/* ---------------------------- HelperCard ---------------------------- */

interface HelperCardProps {
  helper: HelperSummary;
  distanceKm?: number;
  onOffer?: (technicianId: string) => void;
}

export function HelperCard({ helper, distanceKm, onOffer }: HelperCardProps) {
  const statusTone = helper.status === 'available' ? 'success' : helper.status === 'on_job' ? 'warning' : 'neutral';

  return (
    <Card className="byk-helper-card">
      <div className="byk-helper-card__row">
        <div>
          <p className="byk-helper-card__name">{helper.name}</p>
          <p className="byk-helper-card__meta">
            ★ {helper.rating.toFixed(1)} · {helper.skills.join(', ')}
            {typeof distanceKm === 'number' ? ` · ${distanceKm.toFixed(1)} km away` : ''}
          </p>
        </div>
        <Badge tone={statusTone}>{helper.status.replace('_', ' ')}</Badge>
      </div>
      {onOffer && helper.status === 'available' && (
        <Button size="sm" variant="secondary" onClick={() => onOffer(helper.technicianId)}>
          Offer this job
        </Button>
      )}
    </Card>
  );
}

/* Companion CSS:
.byk-helper-card__row { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-3); }
.byk-helper-card__name { font-weight: 600; color: var(--color-text-primary); }
.byk-helper-card__meta { font-size: var(--type-body-sm-size); color: var(--color-text-muted); }
*/
