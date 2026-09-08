import { Platform, useWindowDimensions } from 'react-native';

/**
 * 데스크톱 브라우저의 앱 프레임 폭 — 화면은 전부 폰 기준으로 설계됐으므로 넓은
 * 창에서는 이 폭의 중앙 컬럼 안에서 그린다(#1215 후속, 웹앱 데스크톱 1단계).
 * 방 캔버스·시트·탭바가 1500px로 늘어나는 대신 폰과 같은 비례를 유지한다.
 */
export const APP_FRAME_MAX_WIDTH = 480;

export type AppFrame = ReturnType<typeof useWindowDimensions> & {
  /** 프레임이 창보다 좁아 중앙 컬럼으로 그리는 중인가(웹 데스크톱). */
  framed: boolean;
};

/** 순수 계산 — 훅 밖에서 테스트한다. */
export function resolveAppFrame(
  os: string,
  window: ReturnType<typeof useWindowDimensions>,
): AppFrame {
  const framed = os === 'web' && window.width > APP_FRAME_MAX_WIDTH;
  return framed ? { ...window, width: APP_FRAME_MAX_WIDTH, framed } : { ...window, framed };
}

/**
 * `useWindowDimensions`의 프레임 인지 버전. 네이티브와 좁은 웹 창에서는 창 크기
 * 그대로, 넓은 웹 창에서는 `width`만 프레임 폭으로 바뀐다. 폭으로 레이아웃을
 * 계산하는 곳(탭바·온보딩 카드·화면 전환 슬라이드)은 이 훅을 쓴다.
 */
export function useAppFrame(): AppFrame {
  return resolveAppFrame(Platform.OS, useWindowDimensions());
}
