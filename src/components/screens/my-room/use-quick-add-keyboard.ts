import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, type ScrollView, type TextInput, type View } from 'react-native';

/**
 * 퀵애드 입력행의 키보드·스크롤 배관 — 나의 방 화면에서 뽑아냈다. 키보드
 * 높이를 추적해 스크롤 콘텐츠의 하단 패딩(`keyboardPad`)으로 돌려주고, 입력이
 * 열린 카테고리(`addingCategory`)가 있으면 키보드+패딩이 자리 잡은 뒤 입력행을
 * 키보드 위로 밀어 올린다. 렌더가 읽는 ref·값만 돌려주고 JSX는 화면이 가진다.
 */
export function useQuickAddKeyboard(
  scrollRef: RefObject<ScrollView | null>,
  addingCategory: string | null,
) {
  const addRowRef = useRef<View>(null);
  const todoInputRef = useRef<TextInput>(null);

  // Track the keyboard height: while the quick-add input is open, that much
  // bottom padding is added to the scroll content. Without it, short content
  // has no scroll range at all (scrollTo clamps at the content end) and the
  // input stays hidden behind the keyboard — Android (edge-to-edge) overlays
  // the keyboard without resizing the window.
  const [keyboardPad, setKeyboardPad] = useState(0);
  // Ref mirrors for the measure callback below (kept out of its deps so the
  // callback identity stays stable for the timers/effects that call it).
  const keyboardPadRef = useRef(0);
  const scrollYRef = useRef(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e.endCoordinates?.height ?? 320;
      keyboardPadRef.current = h;
      setKeyboardPad(h);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardPadRef.current = 0;
      setKeyboardPad(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Bring the quick-add input itself into view (not just the category header —
  // long categories left it hidden behind the keyboard). Measured in window
  // coordinates and scrolled by the overflow: measureLayout against
  // getInnerViewNode() silently no-ops when that ref API is unavailable (new
  // architecture), which left the input hidden behind the keyboard.
  const scrollToQuickAdd = useCallback(() => {
    const scrollView = scrollRef.current;
    const row = addRowRef.current;
    if (!scrollView || !row) return;
    row.measureInWindow?.((_x, y, _w, h) => {
      // Keep the input row fully visible above the keyboard, with a margin.
      const visibleBottom = Dimensions.get('window').height - keyboardPadRef.current - 24;
      const overflow = y + h - visibleBottom;
      if (overflow > 0) {
        scrollView.scrollTo({ y: Math.max(0, scrollYRef.current + overflow), animated: true });
      }
    });
  }, [scrollRef]);

  // Re-align once the keyboard is up AND the extra bottom padding has been
  // committed — only then is there guaranteed scroll range for the input.
  useEffect(() => {
    if (!addingCategory || keyboardPad === 0) return;
    const timer = setTimeout(scrollToQuickAdd, 50);
    return () => clearTimeout(timer);
  }, [addingCategory, keyboardPad, scrollToQuickAdd]);

  return { addRowRef, todoInputRef, keyboardPad, scrollYRef, scrollToQuickAdd };
}
