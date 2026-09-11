import { act, render, screen } from '@testing-library/react-native';
import { DeviceEventEmitter, Platform, StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { BottomSheet, __resetSheetSerializer } from '@/components/ui/bottom-sheet';

/**
 * 안드로이드 작성 시트 흔들림 — 키보드를 켰다 끄면 시트가 위아래로 계속 움직였다(갤럭시
 * S25 녹화: 윗변이 296px 폭으로 0.03~0.4초마다 오감). ReactRootView(RN 0.83, API 30+)는
 * 닫힘 이벤트의 screenY에 보이는 영역의 **높이**를 싣는데, 엣지투엣지 Modal 안의
 * KeyboardAvoidingView(height)는 닫힘도 `_onKeyboardChange`로 받아 그 값으로 줄임 높이를
 * 다시 계산한다 → 키보드가 없는데 상태바+내비바만큼 줄어든 채 레이아웃과 엇갈렸다.
 */
const SCREEN_H = 891; // dp — 2340px / 2.625
const STATUS_BAR = 40;
const NAV_BAR = 48;
const KEYBOARD = 282; // ime inset − system bar inset, what keyboardDidShow reports as height

function keyboard(name: 'keyboardDidShow' | 'keyboardDidHide') {
  const shown = name === 'keyboardDidShow';
  return act(async () => {
    DeviceEventEmitter.emit(name, {
      endCoordinates: {
        screenX: 0,
        // Same shapes as ReactRootView.checkForKeyboardEvents.
        screenY: shown ? SCREEN_H - KEYBOARD - NAV_BAR : SCREEN_H - STATUS_BAR - NAV_BAR,
        width: 411,
        height: shown ? KEYBOARD : 0,
      },
      easing: 'keyboard',
      duration: 0,
    });
  });
}

const avoider = () => screen.getByTestId('bottom-sheet-keyboard');
const offset = () => {
  const style = StyleSheet.flatten(avoider().props.style) ?? {};
  return { height: style.height, paddingBottom: style.paddingBottom ?? 0 };
};
/** 네이티브 레이아웃 흉내 — 마지막 렌더가 요구한 높이를 onLayout으로 되돌려 준다. */
async function echoLayout(times = 1) {
  for (let i = 0; i < times; i++) {
    const onLayout = avoider().props.onLayout;
    if (!onLayout) return;
    const height = StyleSheet.flatten(avoider().props.style)?.height ?? SCREEN_H;
    await act(async () => {
      await onLayout({ persist() {}, nativeEvent: { layout: { x: 0, y: 0, width: 411, height } } });
    });
  }
}

describe('BottomSheet avoidKeyboard — Android (#1290)', () => {
  beforeEach(() => {
    __resetSheetSerializer();
    jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('키보드를 닫으면 줄임 없이 원래 크기로 돌아가고, 레이아웃이 다시 와도 그대로다', async () => {
    await render(
      <BottomSheet visible avoidKeyboard onClose={() => {}}>
        <Text>본문</Text>
      </BottomSheet>,
    );
    await echoLayout();
    await keyboard('keyboardDidShow');
    await echoLayout(4);
    await keyboard('keyboardDidHide');
    await echoLayout(6);

    expect(offset()).toEqual({ height: undefined, paddingBottom: 0 });
  });

  it('내비바 인셋은 더하지 않는다 — 시트 본문이 이미 하단 인셋만큼 여백을 갖는다', async () => {
    // 작성 시트 본문은 paddingBottom: max(insets.bottom, 16)을 늘 가진다. 래퍼가 인셋을
    // 또 더하면 키보드 위로 내비바만큼 빈칸이 생긴다(#1291 리뷰). 키보드 높이만 쓰면
    // 키보드에 가려지는 띠가 정확히 그 본문 여백이라 내용이 키보드 윗변에 붙는다.
    await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: STATUS_BAR, bottom: NAV_BAR, left: 0, right: 0 }}>
        <BottomSheet visible avoidKeyboard onClose={() => {}}>
          <Text>본문</Text>
        </BottomSheet>
      </SafeAreaInsetsContext.Provider>,
    );
    await echoLayout();
    await keyboard('keyboardDidShow');

    expect(offset()).toEqual({ height: undefined, paddingBottom: KEYBOARD });
  });

  it('키보드가 뜨면 키보드 높이만큼 시트를 올린다', async () => {
    await render(
      <BottomSheet visible avoidKeyboard onClose={() => {}}>
        <Text>본문</Text>
      </BottomSheet>,
    );
    await echoLayout();
    await keyboard('keyboardDidShow');
    await echoLayout(4);

    expect(offset()).toEqual({ height: undefined, paddingBottom: KEYBOARD });
  });
});
