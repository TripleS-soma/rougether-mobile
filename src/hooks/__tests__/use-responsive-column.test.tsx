/**
 * 태블릿 컬럼은 **기기 분기가 아니라 순수 반응형**이다 (#725) — 폰에서는
 * maxWidth가 화면보다 커서 무해하고, 넓은 화면에서만 실제로 묶인다.
 */
import { renderHook } from '@testing-library/react-native';

import { ContentMaxWidth } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';

describe('useResponsiveColumn (#725)', () => {
  it('가운데 정렬된 고정폭 컬럼을 준다', async () => {
    const { result } = await renderHook(() => useResponsiveColumn());
    expect(result.current).toEqual({
      width: '100%',
      maxWidth: ContentMaxWidth,
      alignSelf: 'center',
    });
  });

  it('더 좁게 묶어야 하는 화면은 상한을 넘길 수 있다 (온보딩)', async () => {
    const { result } = await renderHook(() => useResponsiveColumn(480));
    expect(result.current.maxWidth).toBe(480);
    // 폭을 바꿔도 가운데 정렬과 100% 기준은 유지된다.
    expect(result.current).toMatchObject({ width: '100%', alignSelf: 'center' });
  });

  it('상한이 폰 폭보다 커서 폰에서는 무해하다', () => {
    // 이 앱 화면은 폰 폭(≈390) 전제로 그려졌다 — 상한이 그보다 작으면
    // 폰에서 오히려 잘린다.
    expect(ContentMaxWidth).toBeGreaterThan(390);
  });
});
