import en from '@/i18n/resources/en.json';
import ko from '@/i18n/resources/ko.json';

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
  const koFlat = flatten(ko as Tree);
  const enFlat = flatten(en as Tree);

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
