import { HTMLAttributes, ReactNode, useEffect, useRef } from 'react';

export { Button } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

/* ---------------------------- Badge ---------------------------- */

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`byk-badge byk-badge--${tone}`}>{children}</span>;
}

/* Companion CSS:
.byk-badge {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: 2px var(--space-2); border-radius: var(--radius-full);
  font-family: var(--font-body); font-size: var(--type-caption-size); font-weight: 600;
  line-height: var(--type-caption-lh);
}
.byk-badge--success { background: color-mix(in srgb, var(--color-status-success) 16%, transparent); color: var(--color-status-success); }
.byk-badge--warning { background: color-mix(in srgb, var(--color-status-warning) 20%, transparent); color: var(--color-status-warning); }
.byk-badge--danger  { background: color-mix(in srgb, var(--color-status-danger) 16%, transparent); color: var(--color-status-danger); }
.byk-badge--info    { background: color-mix(in srgb, var(--color-status-info) 16%, transparent); color: var(--color-status-info); }
.byk-badge--neutral { background: var(--color-bg-surface-raised); color: var(--color-text-muted); }
*/

/* ---------------------------- Card ---------------------------- */

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`byk-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* Companion CSS:
.byk-card {
  background: var(--color-bg-surface); border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-md); box-shadow: var(--elevation-1); padding: var(--space-5);
}
*/

/* ---------------------------- Modal ---------------------------- */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape-to-close + return focus to trigger on close.
  useEffect(() => {
    if (!isOpen) return;
    const prevActive = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') trapFocus(e, dialogRef.current);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      prevActive?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="byk-modal-scrim" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="byk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="byk-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="byk-modal__header">
          <h2 id="byk-modal-title" className="byk-modal__title">{title}</h2>
          <button className="byk-modal__close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        <div className="byk-modal__body">{children}</div>
      </div>
    </div>
  );
}

function trapFocus(e: KeyboardEvent, container: HTMLElement | null) {
  if (!container) return;
  const focusables = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* Companion CSS:
.byk-modal-scrim { position: fixed; inset: 0; background: var(--color-overlay-scrim); display: grid; place-items: center; z-index: 100; }
.byk-modal { background: var(--color-bg-surface-raised); border-radius: var(--radius-lg); box-shadow: var(--elevation-modal); max-width: 480px; width: 90vw; padding: var(--space-6); }
.byk-modal__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.byk-modal__title { font-family: var(--font-display); font-size: var(--type-display-md-size); color: var(--color-text-primary); }
.byk-modal__close { background: none; border: none; color: var(--color-text-muted); font-size: 18px; cursor: pointer; padding: var(--space-2); }
.byk-modal__close:focus-visible { outline: 3px solid var(--color-focus-ring); }
*/

/* ---------------------------- Drawer ---------------------------- */

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  side?: 'left' | 'right' | 'bottom';
  children: ReactNode;
}

export function Drawer({ isOpen, onClose, side = 'right', children }: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className={`byk-drawer-scrim ${isOpen ? 'byk-drawer-scrim--open' : ''}`}
      onClick={onClose}
      aria-hidden={!isOpen}
    >
      <div
        className={`byk-drawer byk-drawer--${side} ${isOpen ? 'byk-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* Companion CSS:
.byk-drawer-scrim { position: fixed; inset: 0; background: transparent; pointer-events: none; transition: background var(--motion-duration-base); z-index: 90; }
.byk-drawer-scrim--open { background: var(--color-overlay-scrim); pointer-events: auto; }
.byk-drawer { position: fixed; background: var(--color-bg-surface-raised); box-shadow: var(--elevation-modal); transition: transform var(--motion-duration-base) var(--motion-easing-standard); }
.byk-drawer--right { top: 0; right: 0; height: 100vh; width: min(400px, 90vw); transform: translateX(100%); }
.byk-drawer--right.byk-drawer--open { transform: translateX(0); }
.byk-drawer--bottom { left: 0; right: 0; bottom: 0; max-height: 80vh; border-radius: var(--radius-lg) var(--radius-lg) 0 0; transform: translateY(100%); }
.byk-drawer--bottom.byk-drawer--open { transform: translateY(0); }
*/
