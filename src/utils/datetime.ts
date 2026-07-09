/** "HH:MM" (24h) → "오전 7:00" / "오후 9:30". */
export function formatTime(time: string) {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const ampm = h >= 12 ? '오후' : '오전';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hour12}:${String(m).padStart(2, '0')}`;
}

/** "2026-06-19" → "2026.06.19". */
export function formatDate(d: string) {
  return d.replaceAll('-', '.');
}

/** Local date → "YYYY-MM-DD" (KST-agnostic; uses the device's local day). */
function toIsoDate(dt: Date) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

/** Today as "YYYY-MM-DD" in the device's local time. */
export function todayIso() {
  return toIsoDate(new Date());
}
