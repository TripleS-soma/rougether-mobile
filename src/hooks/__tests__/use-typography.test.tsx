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
  beforeEach(() => AsyncStorage.clear());

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
