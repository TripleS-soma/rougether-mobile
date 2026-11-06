import { renderHook } from '@testing-library/react-native';
import { fetchStarterGacha, STARTER_GACHA_SERVER_READY } from '@/api/starter-gacha';
import { useStarterGacha } from '@/hooks/use-starter-gacha';
import { queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/starter-gacha', () => ({
  ...jest.requireActual('@/api/starter-gacha'),
  fetchStarterGacha: jest.fn(),
  drawStarterGacha: jest.fn(),
}));

/**
 * 서버에 온보딩 뽑기 API가 없는 동안 (#1660) — 신규 사용자마다 404 두 건을 쳐서 GA api_error의
 * 대부분이 "예상된 404"였다. 묻지도 않고 일반 뽑기로 보낸다.
 */
it('서버가 아직 없으면 요청 없이 바로 일반 뽑기로 보낸다 (#1660)', async () => {
  expect(STARTER_GACHA_SERVER_READY).toBe(false);
  const { result } = await renderHook(() => useStarterGacha(true), { wrapper: queryWrapper() });
  expect(result.current.unavailable).toBe(true);
  expect(await result.current.draw()).toBeNull();
  expect(jest.mocked(fetchStarterGacha)).not.toHaveBeenCalled();
});
