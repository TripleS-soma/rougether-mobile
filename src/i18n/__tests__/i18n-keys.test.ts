import { enResources as en, koResources as ko } from '@/i18n';

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});

const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

/**
 * 번역 키 위생 (#893) — 한국어가 원문. 영어는 같은 키를 전부 갖고, 빈 값이 없고,
 * 보간 자리표시자가 일치해야 한다. 새 문구는 ko·en 두 파일에 같이 넣는다.
 */
describe('i18n resources', () => {
  const koFlat = flatten(ko as unknown as Tree);
  const enFlat = flatten(en as unknown as Tree);

  it('도메인 파일끼리 최상위 키가 겹치지 않는다 (병합 시 덮어쓰기 방지)', () => {
    // 병합 결과의 키 수가 각 파일 키 수의 합과 같아야 한다 — 겹치면 하나가 사라진다.
    const files = [
      require('@/i18n/resources/ko/common.json'),
      require('@/i18n/resources/ko/settings.json'),
      require('@/i18n/resources/ko/member.json'),
      require('@/i18n/resources/ko/routineTodo.json'),
      require('@/i18n/resources/ko/house.json'),
      require('@/i18n/resources/ko/roomShop.json'),
      require('@/i18n/resources/ko/notification.json'),
      require('@/i18n/resources/ko/app.json'),
      require('@/i18n/resources/ko/minigame.json'),
      require('@/i18n/resources/ko/feed.json'),
    ] as Tree[];
    const total = files.reduce((n, f) => n + Object.keys(f).length, 0);
    expect(Object.keys(ko).length).toBe(total);
  });

  it('en has every ko key and no extra keys', () => {
    const koKeys = Object.keys(koFlat).sort();
    const enKeys = Object.keys(enFlat).sort();
    expect(enKeys).toEqual(koKeys);
  });

  it('no empty strings in either language', () => {
    const empty = [...Object.entries(koFlat), ...Object.entries(enFlat)]
      .filter(([, v]) => v.trim() === '')
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('interpolation placeholders match between ko and en', () => {
    const mismatched = Object.keys(koFlat).filter(
      (k) =>
        JSON.stringify(placeholders(koFlat[k])) !== JSON.stringify(placeholders(enFlat[k] ?? '')),
    );
    expect(mismatched).toEqual([]);
  });

  it('ko values are Korean and en values are not (catches copy-paste)', () => {
    const hangul = /[가-힣]/;
    const enWithHangul = Object.entries(enFlat)
      .filter(([, v]) => hangul.test(v))
      .map(([k]) => k);
    expect(enWithHangul).toEqual([]);
  });
});
