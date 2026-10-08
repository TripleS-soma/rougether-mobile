import { getAnnouncements } from '@/constants/announcements';

// 피드·거래소가 꺼진 설치본(심사 때 꺼져 있던 1.5.3 바이너리)은 그 소식을 보지 않는다 —
// '피드 보기'를 누르면 없는 화면으로 간다 (2026-10-08).
jest.mock('@/constants/feed', () => ({
  ...jest.requireActual('@/constants/feed'),
  FEED_ENABLED: false,
}));
jest.mock('@/constants/market', () => ({
  ...jest.requireActual('@/constants/market'),
  MARKET_ENABLED: false,
}));

it('꺼진 기능의 소식은 빼고, 나머지는 최신순 그대로', () => {
  const ids = getAnnouncements().map((a) => a.id);
  expect(ids).not.toContain('2026-10-08-feed');
  expect(ids).not.toContain('2026-10-08-market');
  expect(ids.slice(0, 2)).toEqual(['2026-10-08-games', '2026-10-08-routines']);
});
