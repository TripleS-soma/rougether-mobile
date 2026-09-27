import * as Haptics from 'expo-haptics';

import { parseGameFx, playGameFx } from '@/features/minigame/game-fx';

jest.mock('expo-haptics');

describe('game fx (#1425)', () => {
  it('같은 채널의 fx만 받아들이고 모르는 종류·다른 채널·다른 타입은 무시한다', () => {
    expect(parseGameFx(JSON.stringify({ channelId: 'c1', type: 'fx', kind: 'step' }), 'c1')).toBe(
      'step',
    );
    expect(parseGameFx({ channelId: 'c1', type: 'fx', kind: 'over' }, 'c1')).toBe('over');
    expect(parseGameFx({ channelId: 'c2', type: 'fx', kind: 'step' }, 'c1')).toBeNull();
    expect(parseGameFx({ channelId: 'c1', type: 'fx', kind: 'explode' }, 'c1')).toBeNull();
    expect(parseGameFx({ channelId: 'c1', type: 'finish' }, 'c1')).toBeNull();
    expect(parseGameFx('not json', 'c1')).toBeNull();
  });

  it('종류별로 다른 진동 — 계단은 선택, 점프·합치기는 약하게, 이정표는 성공, 끝은 강하게', () => {
    playGameFx('step');
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    playGameFx('jump');
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Light);
    playGameFx('over');
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
    playGameFx('milestone');
    expect(Haptics.notificationAsync).toHaveBeenCalled();
  });
});
