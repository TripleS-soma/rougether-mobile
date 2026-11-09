import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { CHARACTER_ART_AUTOPLAY, CharacterAvatar } from '@/components/room/character-avatar';
import { CharacterIdle } from '@/components/room/character-idle';

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
    const repeat = jest.spyOn(Reanimated, 'withRepeat');
    const ui = await render(
      <CharacterIdle>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    expect(repeat).toHaveBeenCalledTimes(1);
    repeat.mockClear();
    await ui.rerender(
      <CharacterIdle active={false}>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    expect(repeat).not.toHaveBeenCalled();
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
      const sequence = jest.spyOn(Reanimated, 'withSequence');
      await ui.rerender(
        <CharacterIdle pulseKey={1}>
          <Text>고양이</Text>
        </CharacterIdle>,
      );
      expect(sequence).not.toHaveBeenCalled();
    } finally {
      reduceMotion.mockResolvedValue(false);
    }
  });

  it('pulseKey가 바뀌면 한 번 눌렸다 튄다 — 첫 값에서는 튀지 않는다', async () => {
    const sequence = jest.spyOn(Reanimated, 'withSequence');
    const ui = await render(
      <CharacterIdle pulseKey={0}>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    expect(sequence).not.toHaveBeenCalled();
    await ui.rerender(
      <CharacterIdle pulseKey={1}>
        <Text>고양이</Text>
      </CharacterIdle>,
    );
    expect(sequence).toHaveBeenCalledTimes(1);
  });
});

describe('CharacterAvatar 서버 움짤', () => {
  it('서버 포즈 프레임(움직이는 webp)은 재생하지 않고 첫 장면에 멈춘다', async () => {
    expect(CHARACTER_ART_AUTOPLAY).toBe(false);
    const ui = await render(
      <CharacterAvatar characterId="cat" frames={['characters/cat/idle.webp']} />,
    );
    expect(ui.getByTestId('cdn-animation').props.autoplay).toBe(false);
  });
});
