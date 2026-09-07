import type { GachaMachine } from '@/api/adapters';
import { getCategoryGachas, getGachaCategory, isDrawableGacha } from '@/constants/gacha';

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

describe('theme-independent category boxes', () => {
  it('uses the additive category first and exact canonical codes as legacy fallback', () => {
    expect(getGachaCategory({ category: 'WALLPAPER', code: 'future_wallpaper_code' })).toBe(
      'WALLPAPER',
    );
    expect(getGachaCategory({ code: 'floor_gacha' })).toBe('FLOOR');
    expect(getGachaCategory({ category: null, code: 'furniture_gacha' })).toBe('FURNITURE');
    expect(getGachaCategory({ code: 'floor_gacha_special' })).toBeUndefined();
    expect(getGachaCategory({ category: 'UNKNOWN', code: 'floor_gacha' })).toBeUndefined();
  });

  it('orders exactly the existing three server machines without replacing IDs or prices', () => {
    const wallpaper = { ...machine('wallpaper_gacha'), id: 81, costAmount: 120 };
    const floor = { ...machine('floor_gacha'), id: 83, costAmount: 90 };
    const furniture = { ...machine('furniture_gacha'), id: 86, costAmount: 100 };
    const result = getCategoryGachas([furniture, floor, machine('forest_sage'), wallpaper]);
    expect(result).toEqual([wallpaper, floor, furniture]);
    expect(result[0]).toBe(wallpaper);
    expect(result[1]).toBe(floor);
    expect(result[2]).toBe(furniture);
  });

  it('does not invent category boxes from legacy themed machines', () => {
    expect(getCategoryGachas([machine('forest_sage'), machine('calm_hanok')])).toEqual([]);
  });

  it('never exposes a malformed ID or a second machine for the same category', () => {
    const floor = { ...machine('floor_gacha'), id: 4 };
    expect(
      getCategoryGachas([
        { ...machine('wallpaper_gacha'), id: 0 },
        floor,
        { ...machine('floor_gacha'), id: 5 },
      ]),
    ).toEqual([floor]);
  });
});
