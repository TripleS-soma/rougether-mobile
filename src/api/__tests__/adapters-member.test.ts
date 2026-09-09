import {
  toBugReportEntry,
  toCharacterFrames,
  toCharacterFramesMap,
  toOwnedCharacter,
  toAppCharacterId,
} from '@/api/adapters/member';
import { characterIdFromCode } from '@/api/adapters/room';

describe('API adapters — member', () => {
  it('keeps Moru and all four server poses in owned, master, and room mappings', () => {
    const keys = ['idle', 'wave', 'pose-cycle', 'lying'].map(
      (motion) => `characters/moru/animations/${motion}.webp`,
    );
    const poses = keys.map((assetKey, i) => ({ id: i + 1, assetKey, sortOrder: (i + 1) * 10 }));
    const master = { id: 10, code: 'moru', poses: [...poses].reverse() };
    expect(toAppCharacterId(10, [master])).toBe('moru');
    expect(characterIdFromCode('moru')).toBe('moru');
    expect(toCharacterFramesMap([master])).toEqual({ moru: keys });
    expect(toOwnedCharacter({ ...master, characterId: 10, selected: false })).toMatchObject({
      serverId: 10,
      id: 'moru',
      name: '모루',
      frames: keys,
      selected: false,
    });
  });

  it('maps a bug report to the history row (#496)', () => {
    expect(
      toBugReportEntry({
        bugReportId: 7,
        title: '로그인이 안 돼요',
        status: 'IN_PROGRESS',
        screenshotKeys: ['bug/a.png'],
        createdAt: '2026-07-20T09:00:00Z',
      }),
    ).toEqual({
      id: 7,
      title: '로그인이 안 돼요',
      status: 'IN_PROGRESS',
      date: '7월 20일',
      // 첨부 키를 그대로 흘려야 화면이 스크린샷을 받아올 수 있다 (#736).
      screenshotKeys: ['bug/a.png'],
    });
    // 서버가 첨부 키를 안 주면 빈 배열 — 화면이 length로 분기한다.
    expect(toBugReportEntry({ bugReportId: 9 }).screenshotKeys).toEqual([]);
    // 미지정 상태는 접수됨으로.
    expect(toBugReportEntry({ bugReportId: 8 }).status).toBe('RECEIVED');
  });

  it('maps an owned character with its CDN art and pose frames', () => {
    expect(
      toOwnedCharacter({
        userCharacterId: 5,
        characterId: 6,
        code: 'panda',
        name: '판다',
        baseAssetKey: 'characters/panda_sitting.png',
        poses: [
          { id: 2, assetKey: 'characters/panda/poses/wiggle.webp', sortOrder: 20 },
          { id: 1, assetKey: 'characters/panda/poses/idle.webp', sortOrder: 10 },
        ],
        selected: true,
      }),
    ).toEqual({
      serverId: 6,
      id: 'panda',
      name: '판다',
      assetKey: 'characters/panda_sitting.png',
      frames: ['characters/panda/poses/idle.webp', 'characters/panda/poses/wiggle.webp'],
      selected: true,
    });
  });

  it('poses[] wins over the legacy animation set, and non-CDN keys drop (#735)', () => {
    const legacy = {
      idle: 'characters/cat/animations/idle.webp',
      poseCycle: 'characters/cat/animations/pose-cycle.webp',
      wave: 'characters/cat/animations/wave.gif',
    };

    // 등록된 포즈가 있으면 그 순서가 유일한 진실 — 레거시 3칸은 무시된다.
    expect(
      toCharacterFrames(
        [
          { id: 3, assetKey: 'characters/cat/poses/wink.webp', sortOrder: 30 },
          { id: 1, assetKey: 'characters/cat/poses/head.webp', sortOrder: 10 },
          // CDN 키가 아니면 그리지 못하므로 조용히 버린다.
          { id: 4, assetKey: 'legacy/cat.webp', sortOrder: 40 },
          { id: 2, assetKey: 'characters/cat/poses/ear.webp', sortOrder: 20 },
        ],
        legacy,
      ),
    ).toEqual([
      'characters/cat/poses/head.webp',
      'characters/cat/poses/ear.webp',
      'characters/cat/poses/wink.webp',
    ]);

    // 포즈 미등록 캐릭터는 레거시 idle → poseCycle → wave 순서로 폴백.
    expect(toCharacterFrames(undefined, legacy)).toEqual([
      'characters/cat/animations/idle.webp',
      'characters/cat/animations/pose-cycle.webp',
      'characters/cat/animations/wave.gif',
    ]);
    expect(toCharacterFrames([], undefined)).toEqual([]);
  });

  it('builds the master frames map, skipping characters with no art (#735)', () => {
    expect(
      toCharacterFramesMap([
        { id: 1, code: 'cat', poses: [{ id: 1, assetKey: 'characters/cat/poses/idle.webp' }] },
        { id: 2, code: 'otter', animations: { wave: 'characters/otter/animations/wave.webp' } },
        // 프레임이 하나도 없으면 맵에서 빠진다 — 번들 정적 포즈로 폴백.
        { id: 3, code: 'panda' },
        // 앱이 모르는 코드는 캐릭터 id로 접힐 수 없다.
        { id: 4, code: 'dragon', poses: [{ id: 9, assetKey: 'characters/dragon/idle.webp' }] },
      ]),
    ).toEqual({
      cat: ['characters/cat/poses/idle.webp'],
      otter: ['characters/otter/animations/wave.webp'],
    });
  });

  it('drops owned characters without an app-side code or a server id', () => {
    // Unknown code: no local sprite to fall back to → not renderable.
    expect(toOwnedCharacter({ characterId: 9, code: 'dragon', selected: false })).toBeNull();
    // Missing characterId: nothing to send to PUT /me/characters/select.
    expect(toOwnedCharacter({ code: 'cat', selected: false })).toBeNull();
  });

  it('falls back to the local character name when the server omits one', () => {
    expect(toOwnedCharacter({ characterId: 1, code: 'cat', selected: false })).toEqual({
      serverId: 1,
      id: 'cat',
      name: '고양이',
      assetKey: undefined,
      frames: [],
      selected: false,
    });
  });
});
