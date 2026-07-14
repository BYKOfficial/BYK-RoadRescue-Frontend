// GENERATED FILE — do not hand-edit. Source: design-tokens/tokens.json
// Run `npm run tokens:build` (Style Dictionary) to regenerate.
// Use this only where CSS variables aren't reachable (e.g. <canvas>, SVG generated
// server-side, chart libraries that need raw values). Everywhere else, use the
// CSS custom properties directly (`var(--color-status-danger)`), never these raw strings.

export type ThemeName = 'dark' | 'light' | 'hc';

export const tokens = {
  color: {
    bgApp: { dark: '#0e1522', light: '#edeeea', hc: '#000000' },
    bgSurface: { dark: '#16202f', light: '#ffffff', hc: '#000000' },
    bgSurfaceRaised: { dark: '#212d3f', light: '#ffffff', hc: '#000000' },
    borderHairline: { dark: '#263042', light: '#dadcd8', hc: '#ffffff' },
    textPrimary: { dark: '#f4f6f8', light: '#12161c', hc: '#ffffff' },
    textMuted: { dark: '#8a96a6', light: '#4a5460', hc: '#ffffff' },
    brandPrimary: { dark: '#ff7a1a', light: '#ff7a1a', hc: '#ffb347' },
    brandPrimaryPressed: { dark: '#d9640f', light: '#d9640f', hc: '#ffb347' },
    statusSuccess: { dark: '#2fb670', light: '#2fb670', hc: '#4ade80' },
    statusWarning: { dark: '#f5c518', light: '#f5c518', hc: '#ffb347' },
    statusDanger: { dark: '#e23b3b', light: '#e23b3b', hc: '#ff5c5c' },
    statusInfo: { dark: '#5aa9e6', light: '#2e7fc7', hc: '#ffffff' },
    focusRing: { dark: '#ffa24d', light: '#ff7a1a', hc: '#ffb347' },
  },
  font: {
    display: "'Barlow Condensed', 'Arial Narrow', sans-serif",
    body: "'Inter', 'Noto Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'SFMono-Regular', monospace",
  },
  type: {
    displayXl: { size: 56, lineHeight: 1.0, weight: 600 },
    displayLg: { size: 36, lineHeight: 1.05, weight: 600 },
    displayMd: { size: 24, lineHeight: 1.1, weight: 600 },
    bodyMd: { size: 16, lineHeight: 1.5, weight: 400 },
    bodySm: { size: 14, lineHeight: 1.5, weight: 400 },
    caption: { size: 12, lineHeight: 1.4, weight: 500 },
    monoSm: { size: 13, lineHeight: 1.4, weight: 500 },
  },
  space: {
    1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64, 11: 80, 12: 96,
  },
  radius: { sm: 6, md: 10, lg: 16, full: 999 },
  motion: {
    durationFast: 120,
    durationBase: 200,
    durationBeacon: 1400,
    easingStandard: 'cubic-bezier(.2,.8,.2,1)',
  },
} as const;

export function colorFor(token: keyof typeof tokens.color, theme: ThemeName): string {
  return tokens.color[token][theme];
}
