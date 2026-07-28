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
export function toIsoDate(dt: Date) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

/** Today as "YYYY-MM-DD" in the device's local time. */
export function todayIso() {
  return toIsoDate(new Date());
}

/**
 * 상대 시간 라벨 (#508) — 알림처럼 "얼마나 전"이 중요한 목록용.
 * 방금 전 → N분 전 → N시간 전 → N일 전(7일 미만) → 그 이후는 "M월 D일".
 * 미래 시각(서버 시계 편차)은 방금 전으로 뭉갠다.
 */
export function relativeTimeLabel(at: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - at.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${at.getMonth() + 1}월 ${at.getDate()}일`;
}
