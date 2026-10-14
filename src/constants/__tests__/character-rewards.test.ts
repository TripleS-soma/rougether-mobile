import {
  CHARACTER_OPTIONS,
  CHARACTER_UNLOCK_LEVEL,
  STARTER_CHARACTER_OPTIONS,
  characterUnlockOf,
} from '@/constants/characters';

// 모루(레벨 5 보상)는 2026-10-14에 제거됐다 — 목록에 남아 있으면 뽑기·교체에 다시 나온다.
it('lists the eight characters without the removed Moru', () => {
  expect(CHARACTER_OPTIONS.map((c) => c.id)).toEqual([
    'cat',
    'dog',
    'tiger',
    'panda',
    'bear',
    'sheep',
    'horse',
    'otter',
  ]);
  expect(STARTER_CHARACTER_OPTIONS).toEqual(CHARACTER_OPTIONS);
});

// 캐릭터 뽑기·교체는 방 레벨 10에 열린다. 서버 값이 정본이고 없으면 현재 레벨로 판정한다.
describe('characterUnlockOf', () => {
  it('trusts the server flag over the current level', () => {
    // 완료 취소로 현재 레벨이 9로 내려가도 최고 달성 10이면 서버는 true를 준다.
    expect(characterUnlockOf({ growthLevel: 9, characterUnlocked: true })).toEqual({
      unlocked: true,
      level: CHARACTER_UNLOCK_LEVEL,
    });
    expect(characterUnlockOf({ growthLevel: 12, characterUnlocked: false }).unlocked).toBe(false);
  });

  it('falls back to the current level when the server has no flag', () => {
    expect(characterUnlockOf({ growthLevel: 9 }).unlocked).toBe(false);
    expect(characterUnlockOf({ growthLevel: 10 }).unlocked).toBe(true);
    expect(characterUnlockOf(undefined)).toEqual({ unlocked: false, level: 10 });
  });

  it('uses the server unlock level', () => {
    expect(characterUnlockOf({ growthLevel: 7, characterUnlockLevel: 7 })).toEqual({
      unlocked: true,
      level: 7,
    });
  });
});
