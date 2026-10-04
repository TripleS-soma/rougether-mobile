/**
 * 안 보이는 화면의 카탈로그는 시작 때 받지 않는다 (성능 장부 N3) — 뽑기 카탈로그와 집
 * 커버는 `enabled`가 켜질 때(그 화면에 처음 들어갈 때) 받는다.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import { useGacha } from '@/hooks/use-gacha';
import { useHouseCovers } from '@/hooks/use-house-covers';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const realFetch = global.fetch;
let calls: string[] = [];
beforeEach(() => {
  calls = [];
  global.fetch = jest.fn(async (url: string) => {
    calls.push(url);
    return res({ items: [] });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

it('뽑기 카탈로그: enabled=false면 받지 않고, 켜면 받는다', async () => {
  const wrapper = queryWrapper();
  const view = await renderHook(
    ({ enabled }: { enabled: boolean }) => useGacha(jest.fn(), { enabled }),
    {
      wrapper,
      initialProps: { enabled: false },
    },
  );
  await new Promise((r) => setTimeout(r, 30));
  expect(calls.some((u) => u.includes('/gacha?'))).toBe(false);
  await view.rerender({ enabled: true });
  await waitFor(() => expect(calls.some((u) => u.includes('/gacha?'))).toBe(true));
});

it('집 커버: enabled=false면 받지 않고, 켜면 받는다', async () => {
  const wrapper = queryWrapper();
  const view = await renderHook(({ enabled }: { enabled: boolean }) => useHouseCovers(enabled), {
    wrapper,
    initialProps: { enabled: false },
  });
  await new Promise((r) => setTimeout(r, 30));
  expect(calls.some((u) => u.includes('/cover-images'))).toBe(false);
  await view.rerender({ enabled: true });
  await waitFor(() => expect(calls.some((u) => u.includes('/cover-images'))).toBe(true));
});
