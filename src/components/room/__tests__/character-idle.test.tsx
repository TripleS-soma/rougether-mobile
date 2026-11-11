import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Platform, Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { CHARACTER_ART_AUTOPLAY, CharacterAvatar } from '@/components/room/character-avatar';
import { BREATH_MS, CharacterIdle } from '@/components/room/character-idle';
import { NATIVE_DRIVER } from '@/utils/animation';

/**
 * 캐릭터 대기 동작 (2026-11-09) — 서버 움짤은 멈추고, 정지 그림 위에 숨쉬기·탭 반응만 얹는다.
 */
afterEach(() => jest.restoreAllMocks());

describe('CharacterIdle', () => {
  it('발밑을 축으로 움직인다 — 몸이 바닥에서 뜨지 않게', async () => {
    const ui = await render(
      <CharacterIdle>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    const view = ui.getByTestId('character-idle');
    const style = [view.props.style].flat(Infinity).find((s) => s && 'transformOrigin' in s);
    expect(style.transformOrigin).toBe('bottom');
    expect(ui.getByText('고양이')).toBeTruthy();
  });

  it('숨쉬기를 반복 재생하고, 꺼지면(active=false) 반복을 걸지 않는다', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    const ui = await render(
      <CharacterIdle>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    expect(loop).toHaveBeenCalledTimes(1);
    loop.mockClear();
    await ui.rerender(
      <CharacterIdle active={false}>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    expect(loop).not.toHaveBeenCalled();
  });

  // 2026-11-11 제보(갤럭시 S25 울트라): 방에 상주하는 무한 반복을 Reanimated로 돌리자 매 프레임
  // ShadowTree 커밋이 생겨, 셸의 화면 슬라이드(RN Animated 네이티브 드라이버)가 전환 도중 시작
  // 위치로 튀었다. 상주 반복은 커밋을 만들지 않는 네이티브 드라이버로만 돈다.
  it('숨쉬기는 Reanimated가 아니라 RN Animated 네이티브 드라이버로 돈다', async () => {
    const reanimatedRepeat = jest.spyOn(Reanimated, 'withRepeat');
    const reanimatedStyle = jest.spyOn(Reanimated, 'useAnimatedStyle');
    const timing = jest.spyOn(Animated, 'timing');
    await render(
      <CharacterIdle>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    expect(reanimatedRepeat).not.toHaveBeenCalled();
    expect(reanimatedStyle).not.toHaveBeenCalled();
    const breaths = timing.mock.calls.filter(([, config]) => config.duration === BREATH_MS);
    // 들이쉬기·내쉬기 두 구간.
    expect(breaths.map(([, config]) => config.toValue)).toEqual([1, 0]);
    expect(breaths.every(([, config]) => config.useNativeDriver === NATIVE_DRIVER)).toBe(true);
  });

  it('시스템 동작 줄이기가 켜져 있으면 탭해도 튀지 않는다', async () => {
    // RN 목의 isReduceMotionEnabled는 공유 jest.fn이라 restoreAllMocks로 안 돌아온다 — 끝나면 되돌린다.
    const reduceMotion = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    try {
      const ui = await render(
        <CharacterIdle pulseKey={0}>
          <Text>고양이</Text>
        </CharacterIdle>,
      );
      // 설정 조회가 끝나 동작 줄이기가 반영될 때까지.
      await act(async () => {
        await Promise.resolve();
      });
      const spring = jest.spyOn(Animated, 'spring');
      await ui.rerender(
        <CharacterIdle pulseKey={1}>
          <Text>고양이</Text>
        </CharacterIdle>,
      );
      expect(spring).not.toHaveBeenCalled();
    } finally {
      reduceMotion.mockResolvedValue(false);
    }
  });

  it('pulseKey가 바뀌면 한 번 눌렸다 튄다 — 첫 값에서는 튀지 않는다', async () => {
    const spring = jest.spyOn(Animated, 'spring');
    const ui = await render(
      <CharacterIdle pulseKey={0}>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    expect(spring).not.toHaveBeenCalled();
    await ui.rerender(
      <CharacterIdle pulseKey={1}>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    expect(spring).toHaveBeenCalledTimes(1);
    expect(spring.mock.calls[0][1].useNativeDriver).toBe(NATIVE_DRIVER);
  });
});

it('활성이 될 때(active false → true)는 포즈가 그대로면 튀지 않는다 (#1703 리뷰)', async () => {
  const spring = jest.spyOn(Animated, 'spring');
  const ui = await render(
    <CharacterIdle active={false} pulseKey={0}>
      <Text>고양이</Text>
    </CharacterIdle>,
  );
  await ui.rerender(
    <CharacterIdle active pulseKey={0}>
      <Text>고양이</Text>
    </CharacterIdle>,
  );
  expect(spring).not.toHaveBeenCalled();
  // 그 뒤 포즈가 바뀌면 그때 튄다.
  await ui.rerender(
    <CharacterIdle active pulseKey={1}>
      <Text>고양이</Text>
    </CharacterIdle>,
  );
  expect(spring).toHaveBeenCalledTimes(1);
});

describe('CharacterAvatar 서버 움짤', () => {
  it('서버 포즈 프레임(움직이는 webp)은 재생하지 않고 첫 장면에 멈춘다', async () => {
    expect(CHARACTER_ART_AUTOPLAY).toBe(false);
    const ui = await render(
      <CharacterAvatar characterId="cat" frames={['characters/cat/idle.webp']} />,
    );
    expect(ui.getByTestId('cdn-animation').props.autoplay).toBe(false);
  });

  it('웹은 움짤을 멈출 수 없어 번들 정지 그림을 쓴다', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const ui = await render(
      <CharacterAvatar characterId="cat" frames={['characters/cat/idle.webp']} />,
    );
    expect(ui.queryByTestId('cdn-animation')).toBeNull();
    expect(ui.getByLabelText('고양이')).toBeTruthy();
  });
});
