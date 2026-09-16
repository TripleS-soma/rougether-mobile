import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import type { ReactNode } from 'react';

import { useWidgetSync } from '@/components/app/use-widget-sync';
import { LanguageProvider, useLanguage } from '@/hooks/use-language';
import { saveWidgetSummary } from '@/widgets/widget-data';

jest.mock('@/widgets/rougether-widgets', () => ({ refreshWidgets: jest.fn() }));
jest.mock('@/hooks/use-widget-presence', () => ({ useWidgetPresence: jest.fn() }));
jest.mock('@/widgets/widget-data', () => ({
  ...jest.requireActual('@/widgets/widget-data'),
  saveWidgetSummary: jest.fn(() => Promise.resolve()),
  saveWidgetTheme: jest.fn(() => Promise.resolve()),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

// 언어만 바꿔도 위젯 요약을 다시 쓴다 (#893) — 루틴·완료가 그대로여도 위젯 문구가 새 언어를 따라가게.
describe('useWidgetSync', () => {
  it('언어가 바뀌면 같은 루틴이라도 요약을 새 언어로 다시 저장한다', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const props = { resolvedScheme: 'light' as const, routines: [], completions: {}, streak: 0 };
      const { result } = await renderHook(
        () => {
          useWidgetSync(props);
          return useLanguage();
        },
        { wrapper },
      );
      // 첫 요약은 프로바이더가 정한 언어(저장값·기기 언어)로 — 테스트 환경 기기 언어에 기대지 않는다.
      await waitFor(() =>
        expect((saveWidgetSummary as jest.Mock).mock.calls.at(-1)?.[0].lang).toBe(
          result.current.language,
        ),
      );
      const before = (saveWidgetSummary as jest.Mock).mock.calls.length;
      const next = result.current.language === 'en' ? 'ko' : 'en';

      result.current.setLanguage(next);

      await waitFor(() =>
        expect((saveWidgetSummary as jest.Mock).mock.calls.length).toBeGreaterThan(before),
      );
      expect((saveWidgetSummary as jest.Mock).mock.calls.at(-1)[0].lang).toBe(next);
    } finally {
      os.restore();
    }
  });
});
