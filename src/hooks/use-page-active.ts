import { createContext, useContext } from 'react';

/**
 * 탭 페이저 안에서 이 페이지가 지금 보이는지 (성능 장부 M7). 숨은 탭(display:none)의
 * 반복 애니메이션이 UI 스레드 디스플레이 링크를 계속 깨워 배터리·발열을 먹었다 —
 * 반복 연출은 이 값이 false면 멈춘다. 페이저 밖(서브화면·갤러리·테스트)은 항상 true.
 */
export const PageActiveContext = createContext(true);

export function usePageActive(): boolean {
  return useContext(PageActiveContext);
}
