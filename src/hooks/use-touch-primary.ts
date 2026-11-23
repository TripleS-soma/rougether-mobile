import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const QUERY = '(pointer: coarse)';

function mediaQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null;
}

function subscribe(onChange: () => void): () => void {
  const mq = mediaQuery();
  mq?.addEventListener?.('change', onChange);
  return () => mq?.removeEventListener?.('change', onChange);
}

/**
 * 터치가 주 입력인 기기인가. 네이티브는 항상 true. 웹은 `(pointer: coarse)` — 폰·폴더블·태블릿
 * 브라우저는 true, 마우스가 주 입력인 데스크톱(터치스크린 노트북 포함)은 false.
 * 서버 렌더는 false(마크업 일치) — 프레임 판정은 어차피 마운트 뒤에 한다(`useHydrated`).
 */
export function useTouchPrimary(): boolean {
  const web = useSyncExternalStore(
    subscribe,
    () => mediaQuery()?.matches ?? false,
    () => false,
  );
  return Platform.OS !== 'web' || web;
}
