import { FONT_OPTIONS, THEME_OPTIONS } from '@/constants/theme';
import { i18n } from '@/i18n';

// 테마·폰트 표시명은 읽는 시점 언어를 따른다 (#893) — id·swatch는 저장값이라 불변.
describe('테마·폰트 표시명', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('한국어에서는 기존 브랜드명을 그대로 보여준다', () => {
    expect(THEME_OPTIONS.map((o) => o.name)).toEqual([
      '포근',
      '라떼',
      '시트러스 그로브',
      '파스텔 캔디',
      '인디고 타이드',
    ]);
    expect(FONT_OPTIONS.find((o) => o.id === 'nanum')?.name).toBe('나눔스퀘어라운드');
  });

  it('영어로 바꾸면 같은 옵션 객체가 영어 표시명을 돌려준다', async () => {
    await i18n.changeLanguage('en');
    expect(THEME_OPTIONS.map((o) => o.name)).toEqual([
      'Cozy',
      'Latte',
      'Citrus Grove',
      'Pastel Candy',
      'Indigo Tide',
    ]);
    expect(FONT_OPTIONS.map((o) => o.name)).toEqual([
      'NanumSquare Round',
      'Pretendard',
      'Jua Mix',
      'SUIT',
      'System default',
    ]);
    expect(THEME_OPTIONS.map((o) => o.id)).toEqual(['cozy', 'latte', 'citrus', 'pastel', 'indigo']);
    expect(THEME_OPTIONS[0].swatch).toBe('#7FA87F');
  });
});
