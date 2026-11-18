/** One source of truth for readable clock digits; keep precise time internally. */
export function splitClockDisplaySeconds(value: number, countdown = false) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const total = countdown ? Math.ceil(safe) : Math.floor(safe);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { hours, minutes, seconds, hoursPadded: pad(hours),
    minutesPadded: pad(minutes), secondsPadded: pad(seconds) };
}
