import { i18n } from '@/i18n';
import { formatTime, monthDayLabel, relativeTimeLabel } from '@/utils/datetime';

/**
 * 표시용 날짜·시간 포맷의 언어 (#1369) — 한국어 출력은 종전 그대로, 영어는 12시간제·짧은
 * 상대 시간. API 날짜(`todayIso`/`toKstDate`)는 언어와 무관하며 여기서 다루지 않는다.
 */
describe('datetime display labels (#1369)', () => {
  const at = new Date(2026, 8, 16, 9, 0, 0);
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('한국어: 오전/오후·N분 전·M월 D일 (종전과 동일)', () => {
    expect(formatTime('07:00')).toBe('오전 7:00');
    expect(formatTime('21:30')).toBe('오후 9:30');
    expect(formatTime('00:05')).toBe('오전 12:05');
    expect(relativeTimeLabel(at, new Date(at.getTime() + 30_000))).toBe('방금 전');
    expect(relativeTimeLabel(at, new Date(at.getTime() + 3 * 60_000))).toBe('3분 전');
    expect(relativeTimeLabel(at, new Date(at.getTime() + 2 * 3_600_000))).toBe('2시간 전');
    expect(relativeTimeLabel(at, new Date(at.getTime() + 3 * 86_400_000))).toBe('3일 전');
    expect(relativeTimeLabel(at, new Date(at.getTime() + 8 * 86_400_000))).toBe('9월 16일');
    expect(monthDayLabel(at)).toBe('9월 16일');
  });

  it('영어: 7:00 AM · 3m ago · 9/16', async () => {
    await i18n.changeLanguage('en');
    expect(formatTime('07:00')).toBe('7:00 AM');
    expect(formatTime('21:30')).toBe('9:30 PM');
    expect(relativeTimeLabel(at, new Date(at.getTime() + 30_000))).toBe('Just now');
    expect(relativeTimeLabel(at, new Date(at.getTime() + 3 * 60_000))).toBe('3m ago');
    expect(relativeTimeLabel(at, new Date(at.getTime() + 2 * 3_600_000))).toBe('2h ago');
    expect(relativeTimeLabel(at, new Date(at.getTime() + 3 * 86_400_000))).toBe('3d ago');
    expect(monthDayLabel(at)).toBe('9/16');
  });
});
