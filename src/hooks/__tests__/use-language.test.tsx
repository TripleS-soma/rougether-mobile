import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { LanguageProvider, useLanguage } from '@/hooks/use-language';
import { i18n } from '@/i18n';

const wrapper = ({ children }: { children: ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

afterEach(async () => {
  await AsyncStorage.clear();
  await i18n.changeLanguage('ko');
});

describe('useLanguage (#893)', () => {
  it('기본은 한국어, 바꾸면 i18next와 저장소에 즉시 반영된다', async () => {
    const { result } = await renderHook(() => useLanguage(), { wrapper });
    expect(result.current.language).toBe('ko');
    expect(i18n.t('settings.title')).toBe('설정');
    await act(async () => result.current.setLanguage('en'));
    expect(result.current.language).toBe('en');
    expect(i18n.t('settings.title')).toBe('Settings');
    expect(await AsyncStorage.getItem('rougether.language.v1')).toBe('en');
  });

  it('저장된 언어를 마운트 때 읽어 적용하고, 깨진 값은 무시한다', async () => {
    await AsyncStorage.setItem('rougether.language.v1', 'en');
    const { result } = await renderHook(() => useLanguage(), { wrapper });
    await waitFor(() => expect(result.current.language).toBe('en'));
    expect(i18n.t('common.back')).toBe('Back');

    await i18n.changeLanguage('ko');
    await AsyncStorage.setItem('rougether.language.v1', 'xx');
    const second = await renderHook(() => useLanguage(), { wrapper });
    await act(async () => {});
    expect(second.result.current.language).toBe('ko');
  });

  it('프로바이더 밖에서는 기본 언어에 no-op setter', async () => {
    const { result } = await renderHook(() => useLanguage());
    expect(result.current.language).toBe('ko');
    act(() => result.current.setLanguage('en'));
    expect(i18n.language).toBe('ko');
  });
});
