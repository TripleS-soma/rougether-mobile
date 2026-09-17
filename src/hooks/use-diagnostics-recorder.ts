import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onSessionCleared } from '@/api/auth';
import { clearDiagnostics, recordAppState, recordScreen } from '@/lib/diagnostics-log';

/**
 * 버그 제보 진단 기록의 셸 배선 (#1162) — 화면 이동과 앱 전면·백그라운드 전환을 메모리
 * 링버퍼에 남기고, 세션이 지워지면(로그아웃·계정 전환·강제 로그아웃) 비운다.
 * 화면 이름은 셸 라우팅 키(`myRoom`·`gacha` 등)라 사용자 데이터가 섞이지 않는다.
 */
export function useDiagnosticsRecorder(screen: string) {
  useEffect(() => {
    recordScreen(screen);
  }, [screen]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => recordAppState(state));
    const off = onSessionCleared(clearDiagnostics);
    return () => {
      sub.remove();
      off();
    };
  }, []);
}
