import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * iOS 키보드 높이 — `keyboardWillShow`의 height, 내려가면 0.
 *
 * iOS 키보드는 홈 인디케이터 자리까지 덮는다. KeyboardAvoidingView(padding)가 그 높이만큼
 * 화면을 올려 주므로, 키보드가 떠 있는 동안 하단 safe-area 여백을 또 두면 입력줄이 키보드에서
 * 그만큼(34pt) 떠 보인다(2026-11-15 집 채팅 제보). 화면이 이 높이를 하단 인셋과 견줘 여백을
 * 뺄지 정한다 — 하드웨어 키보드처럼 높이가 0에 가까우면 인셋을 그대로 둬야 한다.
 *
 * `will` 이벤트를 쓴다: 키보드와 같은 박자로 여백이 바뀌어야 올라오는 동안 입력줄이 튀지
 * 않는다. 안드로이드는 창이 줄지 않아 계산이 다르다 — `use-android-keyboard-height`.
 */
export function useIosKeyboardHeight(enabled: boolean): number {
  const [height, setHeight] = useState(() =>
    enabled && Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0,
  );
  useEffect(() => {
    if (!enabled) return;
    const show = Keyboard.addListener('keyboardWillShow', (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);
  return enabled ? height : 0;
}
