import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * 정적 export(웹) 하이드레이션 플래그 — 서버 렌더와 클라이언트 첫 렌더는 `false`라 마크업이
 * 일치하고, 마운트 뒤에 `true`가 된다. 창 크기·색 모드처럼 서버가 모르는 값은 이 값이
 * `true`일 때만 반영한다(리팩토링 장부 17번 — 같은 문제를 두 곳이 따로 풀고 있었다).
 * 네이티브는 서버 렌더가 없으니 처음부터 `true`.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
