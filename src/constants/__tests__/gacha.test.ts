import type { GachaMachine } from '@/api/adapters';
import { isDrawableGacha } from '@/constants/gacha';

const machine = (code?: string): GachaMachine =>
  ({ id: 1, name: '뽑기', code, kind: 'furniture' }) as GachaMachine;

describe('쓸 수 없는 뽑기 차단 (#983)', () => {
  it('캐릭터 뽑기는 막는다 — 교체 진입점이 없다 (#637)', () => {
    expect(isDrawableGacha(machine('character_gacha'))).toBe(false);
  });

  it('악세사리 뽑기도 막는다 — 장착 배선이 없다 (#618)', () => {
    // themeId가 있어 kind는 'furniture'로 잡힌다 — code로 걸러야 하는 이유다.
    expect(isDrawableGacha(machine('character_accessories_accessories'))).toBe(false);
  });

  it.each([
    'bakery_morning',
    'calm_hanok',
    'cloud_nap_room',
    'cozy_developer_room',
    'cozy_space',
    'cozy_zombie_hideout',
    'forest_sage',
    'onsen_bath_routine',
    'pastel_cyberpunk_room',
    'rainy_afternoon_study',
    'stationery_study_room',
    'summer_beach_room',
  ])('방 테마 %s 는 그대로 판다', (code) => {
    // 2026-08-26 서버의 방 테마 12종 전량 — 접두 규칙이 과하게 잡지 않는지.
    expect(isDrawableGacha(machine(code))).toBe(true);
  });

  it('코드가 없으면 막지 않는다 — 모르는 것을 숨기지는 않는다', () => {
    expect(isDrawableGacha(machine(undefined))).toBe(true);
  });
});
