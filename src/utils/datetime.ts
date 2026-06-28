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
