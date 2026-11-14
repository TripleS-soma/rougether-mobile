import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { type ReactNode } from 'react';
import { Text } from 'react-native';

import { Typography, typographyFor } from '@/constants/theme';
import {
  BrandThemeProvider,
  useBrandTheme,
  useFontEmphasis,
  useTypography,
} from '@/hooks/use-tokens';

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrandThemeProvider>{children}</BrandThemeProvider>
);

describe('typographyFor (#382)', () => {
  it('maps each role weight to the matching font file, without fontWeight', () => {
    const nanum = typographyFor('nanum');
    expect(nanum.body.fontFamily).toBe('NanumSquareRoundR');
    expect(nanum.label.fontFamily).toBe('NanumSquareRoundB');
    expect(nanum.h1.fontFamily).toBe('NanumSquareRoundEB');
    // Custom fonts must not set fontWeight — Android would fake-bold the face.
    expect(nanum.h1.fontWeight).toBeUndefined();
    // Sizes stay identical to the static scale.
    expect(nanum.body.fontSize).toBe(Typography.body.fontSize);
    expect(nanum.body.lineHeight).toBe(Typography.body.lineHeight);

    const pretendard = typographyFor('pretendard');
    expect(pretendard.large.fontFamily).toBe('Pretendard-Medium');
    expect(pretendard.h3.fontFamily).toBe('Pretendard-SemiBold');
    expect(pretendard.h2.fontFamily).toBe('Pretendard-Bold');
  });

  it('글자 크기 단계: 보통이 기본이고, 크게는 2026-11-14 이전 크기 그대로다', () => {
    expect(typographyFor('nanum')).toBe(typographyFor('nanum', 'medium'));
    expect(Typography.body).toMatchObject({ fontSize: 15, lineHeight: 21 });
    const large = typographyFor('system', 'large');
    expect(large.body).toMatchObject({ fontSize: 18, lineHeight: 26 });
    expect(large.supporting).toMatchObject({ fontSize: 14, lineHeight: 18 });
    expect(large.caption).toMatchObject({ fontSize: 13, lineHeight: 17 });
    expect(large.display1).toMatchObject({ fontSize: 36, lineHeight: 42 });
  });

  it('글자 크기 단계는 롤마다 작게 < 보통 < 크게 순서를 지키고 줄 높이가 글자보다 크다', () => {
    const [small, medium, large] = (['small', 'medium', 'large'] as const).map((id) =>
      typographyFor('system', id),
    );
    for (const role of Object.keys(medium) as (keyof typeof medium)[]) {
      expect(small[role].fontSize).toBeLessThan(medium[role].fontSize);
      expect(medium[role].fontSize).toBeLessThan(large[role].fontSize);
      for (const scale of [small, medium, large])
        expect(scale[role].lineHeight).toBeGreaterThan(scale[role].fontSize);
    }
  });

  it('크기 단계가 달라도 폰트 얼굴은 같다', () => {
    expect(typographyFor('nanum', 'large').label.fontFamily).toBe('NanumSquareRoundB');
    expect(typographyFor('nanum', 'small').label.fontFamily).toBe('NanumSquareRoundB');
    expect(typographyFor('nanum', 'large').body.fontSize).toBe(18);
  });

  it('주아 혼합: headings take Jua, running text stays Pretendard', () => {
    const jua = typographyFor('jua');
    expect(jua.display1.fontFamily).toBe('Jua-Regular');
    expect(jua.h2.fontFamily).toBe('Jua-Regular');
    expect(jua.body.fontFamily).toBe('Pretendard-Regular');
    expect(jua.label.fontFamily).toBe('Pretendard-SemiBold');
  });

  it('system returns the static scale (fontWeight, no fontFamily)', () => {
    const system = typographyFor('system');
    expect(system).toBe(Typography);
    expect(system.h1.fontWeight).toBe('700');
    expect(system.h1.fontFamily).toBeUndefined();
  });
});

describe('useTypography / useFontEmphasis via BrandThemeProvider', () => {
  it('defaults to 나눔스퀘어라운드 and re-resolves when the font changes', async () => {
    const { result } = await renderHook(
      () => ({ control: useBrandTheme(), type: useTypography(), emph: useFontEmphasis() }),
      { wrapper },
    );

    expect(result.current.type.body.fontFamily).toBe('NanumSquareRoundR');
    expect(result.current.emph('bold')).toEqual({ fontFamily: 'NanumSquareRoundEB' });

    await act(() => result.current.control.setFontId('suit'));
    expect(result.current.type.body.fontFamily).toBe('SUIT-Regular');
    expect(result.current.emph('semibold')).toEqual({ fontFamily: 'SUIT-SemiBold' });

    await act(() => result.current.control.setFontId('system'));
    expect(result.current.type.body.fontFamily).toBeUndefined();
    expect(result.current.emph('semibold')).toEqual({ fontWeight: '600' });
  });

  it('persists fontId alongside themeId/mode and restores it on mount', async () => {
    const first = await renderHook(() => useBrandTheme(), { wrapper });
    await act(() => first.result.current.setFontId('pretendard'));
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem('rougether.theme'))!)).toMatchObject({
        fontId: 'pretendard',
      }),
    );

    const second = await renderHook(() => useTypography(), { wrapper });
    await waitFor(() => expect(second.result.current.body.fontFamily).toBe('Pretendard-Regular'));
  });

  it('글자 크기를 저장하고 다음 실행에 되살린다', async () => {
    const first = await renderHook(() => useBrandTheme(), { wrapper });
    expect(first.result.current.fontSizeId).toBe('medium');
    await act(() => first.result.current.setFontSizeId('large'));
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem('rougether.theme'))!)).toMatchObject({
        fontSizeId: 'large',
      }),
    );
    const second = await renderHook(() => useTypography(), { wrapper });
    await waitFor(() => expect(second.result.current.body.fontSize).toBe(18));
  });

  it('크기를 고른 적 없는 기존 저장값과 모르는 크기 값은 기본(보통)으로 둔다', async () => {
    await AsyncStorage.setItem(
      'rougether.theme',
      JSON.stringify({ themeId: 'cozy', mode: 'system', fontId: 'suit', fontSizeId: 'huge' }),
    );
    const { result } = await renderHook(
      () => ({ control: useBrandTheme(), type: useTypography() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.control.fontId).toBe('suit'));
    expect(result.current.control.fontSizeId).toBe('medium');
    expect(result.current.type.body.fontSize).toBe(15);
  });

  it('ignores an unknown saved fontId (falls back to the default)', async () => {
    await AsyncStorage.setItem(
      'rougether.theme',
      JSON.stringify({ themeId: 'cozy', mode: 'system', fontId: 'comic-sans' }),
    );
    const FontProbe = () => <Text>{useTypography().body.fontFamily}</Text>;
    const view = await render(
      <BrandThemeProvider>
        <FontProbe />
      </BrandThemeProvider>,
    );
    // The corrupt entry is ignored — the default 나눔 family stays after restore.
    await act(async () => {});
    expect(view.getByText('NanumSquareRoundR')).toBeTruthy();
  });
});
