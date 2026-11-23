// The browser tab as a status light: an orange badge with the number of sessions waiting for you on the
// favicon and "(2) Waiting for you · Clorbit" in the title; a small blue dot while agents work.
// The counts come from the notification detector, so they follow the same rules as notifications.
import { tp } from '../i18n';

export interface TabCounts { waiting: number; working: number }

export type TabBadge = { kind: 'waiting'; label: string } | { kind: 'working' } | null;

const TITLE = 'Clorbit';
const SIZE = 64;
const WAITING = '#ffb15c'; // --c-waiting: orange is reserved for "waiting for you"
const WORKING = '#5cc8ff'; // --c-working
const RIM = '#03040a';     // --bg: separates the badge from the icon

/** What the favicon shows: waiting wins over working. */
export function tabBadge(c: TabCounts): TabBadge {
  if (c.waiting > 0) return { kind: 'waiting', label: c.waiting > 9 ? '9+' : String(c.waiting) };
  if (c.working > 0) return { kind: 'working' };
  return null;
}

/** The document title: the count of waiting sessions first, so it stays visible in a narrow tab. */
export function tabTitle(c: TabCounts): string {
  return c.waiting > 0 ? `(${c.waiting}) ${tp('tab.waiting', c.waiting)} · ${TITLE}` : TITLE;
}

let base: Promise<HTMLImageElement | null> | null = null;
function baseIcon(): Promise<HTMLImageElement | null> {
  base ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/favicon.svg';
  });
  return base;
}

function iconLinks(): HTMLLinkElement[] {
  return [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')];
}

/** Points every icon link at `url`, or back at the original files when `url` is null. */
function setIcon(url: string | null) {
  for (const l of iconLinks()) {
    if (l.dataset.origHref === undefined) {
      l.dataset.origHref = l.getAttribute('href') ?? '';
      l.dataset.origType = l.getAttribute('type') ?? '';
    }
    if (url) {
      l.setAttribute('href', url);
      l.setAttribute('type', 'image/png');
    } else {
      l.setAttribute('href', l.dataset.origHref);
      if (l.dataset.origType) l.setAttribute('type', l.dataset.origType);
      else l.removeAttribute('type');
    }
  }
}

async function render(badge: Exclude<TabBadge, null>): Promise<string | null> {
  const img = await baseIcon();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d');
  if (!img || !g) return null;
  g.drawImage(img, 0, 0, SIZE, SIZE);
  g.lineWidth = 4;
  g.strokeStyle = RIM;
  if (badge.kind === 'working') {
    g.beginPath();
    g.arc(51, 13, 9, 0, Math.PI * 2);
    g.fillStyle = WORKING;
    g.fill();
    g.stroke();
  } else {
    g.beginPath();
    g.arc(46, 18, 17, 0, Math.PI * 2);
    g.fillStyle = WAITING;
    g.fill();
    g.stroke();
    g.fillStyle = '#1b0f02';
    g.font = `800 ${badge.label.length > 1 ? 19 : 24}px Inter, ui-sans-serif, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(badge.label, 46, 19.5);
  }
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

let shown = '';
let seq = 0;

/** Brings the title and the favicon in line with the counts; cheap to call on every update. */
export function updateTab(c: TabCounts) {
  const title = tabTitle(c);
  if (document.title !== title) document.title = title;
  const badge = tabBadge(c);
  const key = badge ? (badge.kind === 'waiting' ? `w${badge.label}` : 'work') : '';
  if (key === shown) return;
  shown = key;
  const my = ++seq;
  if (!badge) return setIcon(null);
  void render(badge).then((url) => {
    // A newer update may have landed while the icon was loading.
    if (my === seq) setIcon(url);
  });
}

/** Back to the plain title and favicon (the notification center unmounts). */
export function resetTab() {
  updateTab({ waiting: 0, working: 0 });
}
