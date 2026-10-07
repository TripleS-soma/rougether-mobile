import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useHydrated } from '@/hooks/use-hydrated';

describe('useHydrated (리팩토링 장부 17번)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('네이티브는 처음부터 true', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { result } = await renderHook(() => useHydrated());
    expect(result.current).toBe(true);
  });

  it('웹은 첫 렌더 false(서버 마크업과 일치), 마운트 뒤 true', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const seen: boolean[] = [];
    await renderHook(() => {
      const hydrated = useHydrated();
      seen.push(hydrated);
      return hydrated;
    });
    expect(seen[0]).toBe(false);
    expect(seen.at(-1)).toBe(true);
  });
});
