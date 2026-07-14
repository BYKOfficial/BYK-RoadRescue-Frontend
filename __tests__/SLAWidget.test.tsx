import { render, screen } from '@testing-library/react';
import { SLAWidget } from '../src/components/dashboard/SLAWidget';

const REFERENCE_WINDOW_MS = 30 * 60 * 1000;

describe('SLAWidget', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-14T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders "ok" state well before the deadline', () => {
    const deadline = new Date(Date.now() + REFERENCE_WINDOW_MS * 0.9).toISOString();
    render(<SLAWidget slaDeadline={deadline} />);
    const el = screen.getByRole('img');
    expect(el.className).toContain('byk-sla-widget--ok');
  });

  it('crosses into "warning" state at 70% of the window consumed', () => {
    // 29% of the window remaining -> just past the 30% warning threshold boundary
    const deadline = new Date(Date.now() + REFERENCE_WINDOW_MS * 0.29).toISOString();
    render(<SLAWidget slaDeadline={deadline} />);
    const el = screen.getByRole('img');
    expect(el.className).toContain('byk-sla-widget--warning');
  });

  it('renders "breached" state and shows elapsed overage when the deadline has passed', () => {
    const deadline = new Date(Date.now() - 45_000).toISOString(); // 45s past deadline
    render(<SLAWidget slaDeadline={deadline} />);
    const el = screen.getByRole('img');
    expect(el.className).toContain('byk-sla-widget--breached');
    expect(el.getAttribute('aria-label')).toMatch(/SLA breached by 45 seconds/);
  });

  it('updates the label every second without requiring a re-render trigger from props', () => {
    const deadline = new Date(Date.now() + 65_000).toISOString();
    render(<SLAWidget slaDeadline={deadline} />);
    expect(screen.getByText('1:05')).toBeInTheDocument();

    jest.advanceTimersByTime(5000);
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });
});
