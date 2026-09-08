import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { Routine } from '@/constants/routines';
import { useWidgetPresence } from '@/hooks/use-widget-presence';
import { isScheduledOn } from '@/components/screens/my-room-screen';
import { todayIso } from '@/utils/datetime';
import { refreshWidgets } from '@/widgets/rougether-widgets';
import { buildWidgetSummary, saveWidgetSummary, saveWidgetTheme } from '@/widgets/widget-data';

/**
 * 홈 위젯 동기화 (앱 셸에서 분리, 리팩토링 4묶음) — 셸의 다른 어떤 상태와도 결합이 없다.
 *
 * - 오늘 요약 (#604 안드, #606 iOS): 완료 토글·루틴 변경·스트릭 갱신이 위젯에 바로
 *   반영되게 요약을 기록하고 재렌더를 민다. 같은 요약이면(직렬화 비교) 쓰지 않는다.
 * - 다크모드 (#746): 앱의 테마 모드가 적용된 실효 스킴을 위젯 저장소에 기록한다. 위젯은
 *   시스템 설정만 볼 수 있어, 앱에서 다크로 바꿔도 위젯이 라이트로 남던 불일치를 없앤다.
 * - 마지막 접속 (#1122): 위젯이 미접속 일수로 표정을 바꾼다.
 */
export function useWidgetSync({
  resolvedScheme,
  routines,
  completions,
  streak,
}: {
  resolvedScheme: 'light' | 'dark';
  routines: Routine[];
  completions: Record<string, string[]>;
  streak: number;
}) {
  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    void saveWidgetTheme(resolvedScheme === 'dark').then(refreshWidgets);
  }, [resolvedScheme]);

  useWidgetPresence();

  const summarySigRef = useRef('');
  useEffect(() => {
    // 홈 위젯이 있는 플랫폼만 — 웹은 제외.
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    const today = todayIso();
    const summary = buildWidgetSummary(
      routines.filter((r) => isScheduledOn(r, today)),
      completions,
      streak,
      today,
    );
    const sig = JSON.stringify(summary);
    if (sig === summarySigRef.current) return;
    summarySigRef.current = sig;
    void saveWidgetSummary(summary).then(refreshWidgets);
  }, [routines, completions, streak]);
}
