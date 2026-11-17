import { t, type MsgKey } from '../i18n';

/** Branch palette: the same values as --b1..--b8 in theme.css. */
export const BRANCH = ['#5cc8ff', '#a78bfa', '#ff6fb0', '#4fe0b0', '#e6e36a', '#6b7cff', '#ff7b7b', '#9af06b'];

export const STATUS = {
  working: '#5cc8ff',
  waiting: '#ffb15c',
  idle: '#8c90aa',
  done: '#4d5670',
  danger: '#ff5c7a',
};

export const TOKEN_COLORS = {
  input: '#5cc8ff',
  output: '#ff6fb0',
  cacheRead: '#6b7cff',
  cacheWrite: '#a78bfa',
};

export type TokenKind = keyof typeof TOKEN_COLORS;

const TOKEN_LABEL_KEYS: Record<TokenKind, MsgKey> = {
  input: 'tokens.input',
  output: 'tokens.output',
  cacheRead: 'tokens.cacheRead',
  cacheWrite: 'tokens.cacheWrite',
};

/** Localized token-kind label, evaluated at render time. */
export function tokenLabel(k: TokenKind): string {
  return t(TOKEN_LABEL_KEYS[k]);
}

export function branchColor(i: number): string {
  return BRANCH[((i % BRANCH.length) + BRANCH.length) % BRANCH.length];
}

/** Stable model color: the model family picks the hue. */
export function modelColor(model: string, fallbackIndex = 0): string {
  const m = model.toLowerCase();
  if (m.includes('[1m]')) return BRANCH[2];
  if (m.includes('opus')) return BRANCH[1];
  if (m.includes('sonnet')) return BRANCH[0];
  if (m.includes('haiku')) return BRANCH[3];
  if (m.includes('fable')) return BRANCH[4];
  return branchColor(fallbackIndex + 4);
}

/** Shade of a branch color for deeper levels (satellites are lighter). */
export function shade(hex: string, depth: number): string {
  if (depth <= 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  const mix = Math.min(0.55, (depth - 1) * 0.28);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const to = (c: number) => Math.round(c + (255 - c) * mix);
  return `#${((1 << 24) | (to(r) << 16) | (to(g) << 8) | to(b)).toString(16).slice(1)}`;
}

export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
