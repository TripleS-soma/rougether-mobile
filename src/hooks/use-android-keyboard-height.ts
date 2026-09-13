import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * 안드로이드 키보드 높이 (#1290) — keyboardDidShow의 height를 그대로 쓰고 닫히면 0.
 *
 * KeyboardAvoidingView(height)는 안드로이드에서 닫힘도 `_onKeyboardChange`로 받아, 닫힘
 * 이벤트의 screenY(보이는 영역의 **높이**)로 줄임을 다시 계산한다. 엣지투엣지 Modal은
 * 프레임이 화면 전체라 키보드가 없는데도 상태바+내비바만큼 줄임이 남고, height 모드가
 * 직전 줄임을 계산에 되먹여 레이아웃과 엇갈리며 시트가 계속 위아래로 흔들렸다(갤럭시
 * S25 녹화). 여기선 레이아웃 결과를 계산에 쓰지 않으니 되먹임이 생길 수 없다.
 *
 * 화면 단위에서도 같다 (#1326): 엣지투엣지에서는 창이 안 줄어들어 `padding`/`height`
 * 모두 무력하므로, 이 높이만큼 아래 여백을 직접 주는 게 유일하게 맞는 처방이다.
 * 하단 safe-area 인셋을 이 값에 더하지 말 것 — 키보드가 이미 그 위에 올라온다.
 */
export function useAndroidKeyboardHeight(enabled: boolean): number {
  const [height, setHeight] = useState(() =>
    enabled && Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0,
  );
  useEffect(() => {
    if (!enabled) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);
  return enabled ? height : 0;
}
