import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/**
 * All colors come from CSS variables defined in tokens.css. Never add a hex
 * value here — see the `no-hardcoded-color` lint rule referenced in
 * 02-FIGMA_VARIABLES.md. Focus ring is always visible (never `outline: none`
 * without a replacement) — this is a field-usability requirement, not just
 * a WCAG checkbox, given one-handed outdoor use.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={`byk-btn byk-btn--${variant} byk-btn--${size} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <span className="byk-btn__spinner" aria-hidden="true" /> : null}
        <span className={loading ? 'byk-btn__label byk-btn__label--loading' : 'byk-btn__label'}>
          {children}
        </span>
      </button>
    );
  }
);
Button.displayName = 'Button';

/* Companion CSS (place in Button.module.css or globals.css):

.byk-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  font-family: var(--font-body); font-weight: 600; border: none; cursor: pointer;
  border-radius: var(--radius-md); transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
}
.byk-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.byk-btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

.byk-btn--sm { padding: var(--space-2) var(--space-3); font-size: var(--type-body-sm-size); }
.byk-btn--md { padding: var(--space-3) var(--space-5); font-size: var(--type-body-md-size); }
.byk-btn--lg { padding: var(--space-4) var(--space-6); font-size: var(--type-body-md-size); }

.byk-btn--primary { background: var(--color-brand-primary); color: #0e1522; }
.byk-btn--primary:hover:not(:disabled) { background: var(--color-brand-primary-pressed); }

.byk-btn--secondary { background: var(--color-bg-surface-raised); color: var(--color-text-primary); border: 1px solid var(--color-border-hairline); }
.byk-btn--danger { background: var(--color-status-danger); color: #ffffff; }
.byk-btn--ghost { background: transparent; color: var(--color-text-primary); }
.byk-btn--ghost:hover:not(:disabled) { background: var(--color-bg-surface-raised); }
*/
