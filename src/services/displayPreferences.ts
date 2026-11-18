/**
 * Per-device presentation controls. These are intentionally local-only:
 * a tablet can use a different zoom than a phone or desktop.
 */
export interface DisplayPreferences {
  uiScale: number;
  textScale: number;
}

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  uiScale: 100,
  textScale: 100,
};
export const DISPLAY_LIMITS = {
  uiScale: { min: 70, max: 140, step: 5 },
  textScale: { min: 80, max: 150, step: 5 },
} as const;
const KEY = 'nevofocus_display_preferences_v1';

function within(value: unknown, name: keyof DisplayPreferences): number {
  const { min, max, step } = DISPLAY_LIMITS[name];
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.max(min, Math.min(max, Math.round(number / step) * step));
}

export function readDisplayPreferences(): DisplayPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_DISPLAY_PREFERENCES };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    return {
      uiScale: within(parsed.uiScale ?? 100, 'uiScale'),
      textScale: within(parsed.textScale ?? 100, 'textScale'),
    };
  } catch {
    return { ...DEFAULT_DISPLAY_PREFERENCES };
  }
}

function applyToDocument(values: DisplayPreferences): void {
  if (typeof document === 'undefined') return;
  // CSS zoom changes all elements (including px-sized controls) in Chromium/WebView.
  // Rem-based Tailwind type sizes also respond to the root font-size.
  document.documentElement.style.zoom = `${values.uiScale}%`;
  document.documentElement.style.fontSize = `${16 * values.textScale / 100}px`;
  document.documentElement.style.setProperty('--nevo-text-scale', String(values.textScale / 100));
}

/** Apply persisted preferences before React renders, avoiding a size flash. */
export function applySavedDisplayPreferences(): DisplayPreferences {
  const values = readDisplayPreferences();
  applyToDocument(values);
  return values;
}

/** Immediately apply and persist changes; keep stored auth/study data untouched. */
export function saveDisplayPreferences(update: Partial<DisplayPreferences>): DisplayPreferences {
  const current = readDisplayPreferences();
  const values: DisplayPreferences = {
    uiScale: within(update.uiScale ?? current.uiScale, 'uiScale'),
    textScale: within(update.textScale ?? current.textScale, 'textScale'),
  };
  applyToDocument(values);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(values));
  } catch {
    // Still apply the scale even if the browser disallows localStorage.
  }
  return values;
}
