import { renderHook, waitFor } from '@testing-library/react-native';

import { useHouseCovers } from '@/hooks/use-house-covers';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('useHouseCovers', () => {
  it('커버 카탈로그를 불러오고 이미지 키가 없는 항목은 거른다', async () => {
    global.fetch = jest.fn(async () =>
      res({
        items: [
          { code: 'cloud', name: '구름집', coverImageKey: 'house/cloud/frame.png' },
          { code: 'broken', name: '키 없음', coverImageKey: null },
          { code: null, name: null, coverImageKey: 'house/plain/frame.png' },
        ],
      }),
    ) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useHouseCovers(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));
    expect(result.current.covers).toEqual([
      { code: 'cloud', name: '구름집', coverImageKey: 'house/cloud/frame.png' },
      // code·name이 없으면 키를 코드로, 이름은 빈 문자열로 (toHouseCover).
      { code: 'house/plain/frame.png', name: '', coverImageKey: 'house/plain/frame.png' },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('조회에 실패해도 빈 목록으로 접는다 — 폼은 커버 섹션을 숨길 뿐', async () => {
    global.fetch = jest.fn(async () => res({ code: 'X' }, 500)) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useHouseCovers(), { wrapper: queryWrapper() });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    // 실패는 조용히 — 빈 배열이 유지된다.
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.covers).toEqual([]);
  });
});
