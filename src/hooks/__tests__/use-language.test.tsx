import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { detectDeviceLanguage, LanguageProvider, useLanguage } from '@/hooks/use-language';
import { i18n } from '@/i18n';

// 기기 언어 목 (#893 3단계) — 테스트마다 mockDeviceLang을 바꾼다(호이스팅된 팩토리라 mock 접두 변수만 참조 가능).
let mockDeviceLang: string | null = 'ko';
jest.mock('expo-localization', () => ({
  getLocales: () => (mockDeviceLang ? [{ languageCode: mockDeviceLang }] : []),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

afterEach(async () => {
  cleanup();
  // 마운트 이펙트의 loadLanguage() 프라미스가 다음 테스트로 새지 않게 한 틱 비운다.
  await act(async () => {});
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
    // 비동기 렌더러에선 동기 act가 다음 렌더 큐를 망가뜨린다 — 반드시 await.
    await act(async () => result.current.setLanguage('en'));
    expect(i18n.language).toBe('ko');
  });

  it('저장된 선택이 없으면 기기 언어를 따른다 — en 기기는 영어, 미지원 언어는 영어, 저장은 안 함', async () => {
    mockDeviceLang = 'en';
    try {
      const { result } = await renderHook(() => useLanguage(), { wrapper });
      await act(async () => {});
      await waitFor(() => expect(result.current?.language).toBe('en'));
      expect(await AsyncStorage.getItem('rougether.language.v1')).toBeNull();
      expect(detectDeviceLanguage()).toBe('en');
      mockDeviceLang = 'ja';
      expect(detectDeviceLanguage()).toBe('en');
      mockDeviceLang = null;
      expect(detectDeviceLanguage()).toBe('ko');
    } finally {
      mockDeviceLang = 'ko';
    }
  });

  it('저장된 선택이 있으면 기기 언어보다 우선한다', async () => {
    mockDeviceLang = 'en';
    try {
      await AsyncStorage.setItem('rougether.language.v1', 'ko');
      const { result } = await renderHook(() => useLanguage(), { wrapper });
      await act(async () => {});
      expect(result.current?.language).toBe('ko');
      expect(i18n.language).toBe('ko');
    } finally {
      mockDeviceLang = 'ko';
    }
  });
});
