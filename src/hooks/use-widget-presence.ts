import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { refreshWidgets } from '@/widgets/rougether-widgets';
import { saveWidgetLastActive } from '@/widgets/widget-data';

/**
 * 홈 위젯용 "마지막 접속" 기록 (#1122) — 앱이 실제로 포그라운드가 될 때만
 * 남긴다(마운트 시 이미 active면 즉시). 앱 아이콘(#1147)의 방문 판정과 같은
 * 기준이라, 푸시 수신·백그라운드 조회는 접속으로 치지 않는다. 기록 뒤 위젯을
 * 바로 다시 그려 "N일째" 표정이 즉시 풀린다.
 */
export function useWidgetPresence() {
  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    const mark = () => {
      void saveWidgetLastActive(new Date().toISOString()).then(refreshWidgets);
    };
    if (AppState.currentState === 'active') mark();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') mark();
    });
    return () => sub.remove();
  }, []);
}
