import { fireEvent, render, renderHook } from '@testing-library/react-native';
import { Platform, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { LandscapeStage, useLandscapeStage } from '@/components/minigame/landscape-stage';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

const dims = (width: number, height: number) =>
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height, scale: 3, fontScale: 1 });

describe('LandscapeStage — 루틴 러너 가로 플레이', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    dims(390, 844);
  });

  it('판을 90° 돌려 폰의 세로를 긴 변으로 쓰고, 나가기를 누르면 onExit', async () => {
    const onExit = jest.fn();
    const ui = await render(
      <LandscapeStage visible aspect={720 / 420} onExit={onExit}>
        <Text>게임판</Text>
      </LandscapeStage>,
    );
    expect(ui.getByText('게임판')).toBeTruthy();
    const stage = StyleSheet.flatten(ui.getByTestId('landscape-stage').props.style);
    expect(stage.transform).toEqual([{ rotate: '90deg' }]);
    // 짧은 변(폰 폭 390)이 판 높이 — 긴 변이 폰 세로.
    expect(stage.height).toBe(390);
    expect(stage.width).toBeGreaterThan(stage.height);
    // 중심을 창 중심에 직접 맞춘다 — 넘치는 긴 변을 중앙 정렬에 맡기지 않는다.
    expect(stage.left + stage.width / 2).toBe(390 / 2);
    expect(stage.top + stage.height / 2).toBe(844 / 2);

    await fireEvent.press(ui.getByLabelText('게임 그만하기'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('노치·홈 인디케이터 인셋은 긴 변 양끝에서 큰 쪽만큼 비운다', async () => {
    const ui = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}>
        <LandscapeStage visible aspect={720 / 420} onExit={jest.fn()}>
          <Text>게임판</Text>
        </LandscapeStage>
      </SafeAreaInsetsContext.Provider>,
    );
    const stage = StyleSheet.flatten(ui.getByTestId('landscape-stage').props.style);
    expect(stage.width).toBe(844 - 2 * 59);
  });

  it('visible=false면 게임 문서를 내린다 — 끝난 판은 세로 결과 화면이 이어받는다', async () => {
    const ui = await render(
      <LandscapeStage visible={false} aspect={720 / 420} onExit={jest.fn()}>
        <Text>게임판</Text>
      </LandscapeStage>,
    );
    expect(ui.queryByText('게임판')).toBeNull();
  });

  it('세로 폰에서만 켠다 — 태블릿·가로 창·웹은 그대로', async () => {
    const run = async () => (await renderHook(() => useLandscapeStage())).result.current;
    dims(390, 844);
    expect(await run()).toBe(true);
    dims(820, 1180);
    expect(await run()).toBe(false);
    dims(844, 390);
    expect(await run()).toBe(false);
    dims(390, 844);
    jest.replaceProperty(Platform, 'OS', 'web');
    expect(await run()).toBe(false);
  });
});
