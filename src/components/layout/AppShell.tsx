import { ReactNode } from 'react';
import { useStore } from '../../store';
import { useConnectionState } from '../../store';
import { Badge } from '../primitives';

/* ---------------------------- AppShell ---------------------------- */

interface AppShellProps {
  topBar: ReactNode;
  sideNav?: ReactNode;
  children: ReactNode;
}

/**
 * AppShell is intentionally dumb — it only handles layout grid and the
 * global degraded-mode banner. It never subscribes to job-level data so
 * that a GPS ping anywhere in the app doesn't re-render the whole shell.
 */
export function AppShell({ topBar, sideNav, children }: AppShellProps) {
  const { wsState, isPolling } = useConnectionState();
  const theme = useStore((s) => s.theme);

  return (
    <div className="byk-shell" data-theme={theme}>
      <a href="#byk-main-content" className="byk-skip-link">
        Skip to main content
      </a>
      {topBar}
      <div className="byk-shell__body">
        {sideNav}
        <main id="byk-main-content" className="byk-shell__main">
          {(wsState === 'degraded' || wsState === 'offline') && (
            <div
              className={`byk-degraded-banner byk-degraded-banner--${wsState}`}
              role="status"
              aria-live="polite"
            >
              {wsState === 'offline'
                ? isPolling
                  ? 'Live connection lost — updating every 15 seconds instead.'
                  : 'Live connection lost — reconnecting…'
                : 'Live connection unstable — some updates may be delayed.'}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

/* Companion CSS:
.byk-shell { min-height: 100vh; background: var(--color-bg-app); color: var(--color-text-primary); font-family: var(--font-body); }
.byk-skip-link { position: absolute; left: -9999px; top: 0; background: var(--color-brand-primary); color: #0e1522; padding: var(--space-2) var(--space-4); z-index: 200; }
.byk-skip-link:focus { left: var(--space-4); top: var(--space-4); }
.byk-shell__body { display: flex; }
.byk-shell__main { flex: 1; min-width: 0; padding: var(--space-6); }
.byk-degraded-banner { padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: var(--type-body-sm-size); font-weight: 600; }
.byk-degraded-banner--degraded { background: color-mix(in srgb, var(--color-status-warning) 20%, transparent); color: var(--color-status-warning); }
.byk-degraded-banner--offline { background: color-mix(in srgb, var(--color-status-danger) 16%, transparent); color: var(--color-status-danger); }
*/

/* ---------------------------- TopBar ---------------------------- */

interface TopBarProps {
  role: 'customer' | 'technician' | 'dispatcher' | 'admin';
  userName: string;
}

export function TopBar({ role, userName }: TopBarProps) {
  const { wsState } = useConnectionState();
  const toggleSideNav = useStore((s) => s.toggleSideNav);

  const dotTone = wsState === 'online' ? 'success' : wsState === 'degraded' ? 'warning' : 'danger';

  return (
    <header className="byk-topbar">
      <button
        className="byk-topbar__nav-toggle"
        onClick={toggleSideNav}
        aria-label="Toggle navigation menu"
      >
        ☰
      </button>
      <div className="byk-topbar__brand">
        <span className="byk-topbar__brand-mark" aria-hidden="true" />
        BYK RoadRescue
      </div>
      <div className="byk-topbar__right">
        <span className="byk-topbar__conn" title={`Connection: ${wsState}`}>
          <span className={`byk-conn-dot byk-conn-dot--${dotTone}`} aria-hidden="true" />
          <span className="byk-visually-hidden">Connection status: {wsState}</span>
        </span>
        <Badge tone="neutral">{role}</Badge>
        <span className="byk-topbar__user">{userName}</span>
      </div>
    </header>
  );
}

/* Companion CSS:
.byk-topbar { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-3) var(--space-5); background: var(--color-bg-surface); border-bottom: 1px solid var(--color-border-hairline); position: sticky; top: 0; z-index: 50; }
.byk-topbar__nav-toggle { background: none; border: none; color: var(--color-text-primary); font-size: 20px; cursor: pointer; display: none; }
.byk-topbar__brand { font-family: var(--font-display); font-weight: 600; font-size: var(--type-display-md-size); display: flex; align-items: center; gap: var(--space-2); }
.byk-topbar__brand-mark { width: 12px; height: 12px; border-radius: var(--radius-full); background: var(--color-brand-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-brand-primary) 20%, transparent); }
.byk-topbar__right { margin-left: auto; display: flex; align-items: center; gap: var(--space-3); }
.byk-conn-dot { display: inline-block; width: 8px; height: 8px; border-radius: var(--radius-full); }
.byk-conn-dot--success { background: var(--color-status-success); }
.byk-conn-dot--warning { background: var(--color-status-warning); }
.byk-conn-dot--danger { background: var(--color-status-danger); }
.byk-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 768px) { .byk-topbar__nav-toggle { display: block; } .byk-topbar__user { display: none; } }
*/

/* ---------------------------- SideNav ---------------------------- */

interface SideNavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

export function SideNav({ items, activeHref }: { items: SideNavItem[]; activeHref: string }) {
  const collapsed = useStore((s) => s.sideNavCollapsed);

  return (
    <nav className={`byk-sidenav ${collapsed ? 'byk-sidenav--collapsed' : ''}`} aria-label="Primary">
      <ul className="byk-sidenav__list">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className={`byk-sidenav__link ${item.href === activeHref ? 'byk-sidenav__link--active' : ''}`}
              aria-current={item.href === activeHref ? 'page' : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* Companion CSS:
.byk-sidenav { width: 220px; background: var(--color-bg-surface); border-right: 1px solid var(--color-border-hairline); padding: var(--space-4) var(--space-2); transition: width var(--motion-duration-base) var(--motion-easing-standard); }
.byk-sidenav--collapsed { width: 64px; }
.byk-sidenav__list { display: flex; flex-direction: column; gap: var(--space-1); list-style: none; }
.byk-sidenav__link { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border-radius: var(--radius-md); color: var(--color-text-muted); text-decoration: none; font-size: var(--type-body-sm-size); font-weight: 600; }
.byk-sidenav__link:hover { background: var(--color-bg-surface-raised); color: var(--color-text-primary); }
.byk-sidenav__link--active { background: color-mix(in srgb, var(--color-brand-primary) 14%, transparent); color: var(--color-brand-primary); }
.byk-sidenav__link:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: -2px; }
@media (max-width: 768px) { .byk-sidenav { position: fixed; inset: 56px 0 0 0; z-index: 80; width: 100%; transform: translateX(-100%); } .byk-sidenav--collapsed { transform: translateX(-100%); } }
*/
