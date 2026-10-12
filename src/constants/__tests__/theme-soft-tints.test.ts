import { DarkThemes, Themes, withAlpha } from '@/constants/theme';

/**
 * soft 틴트는 기본색 + 알파 '22'로 파생된다(장부 24번). 파생 전 손으로 적던 리터럴을
 * 그대로 박아 두어, 파생으로 바꾼 뒤에도 모든 테마의 값이 한 글자도 안 바뀌었음을 고정한다.
 */
const PREVIOUS_LITERALS = {
  Themes: {
    cozy: {
      primarySoft: '#7FA87F22',
      warningSoft: '#E8A24A22',
      dangerSoft: '#D6787822',
    },
    forest: {
      primarySoft: '#5F9B6A22',
      warningSoft: '#E8A24A22',
      dangerSoft: '#D6787822',
    },
    hanok: {
      primarySoft: '#9A7B4F22',
      warningSoft: '#C9943F22',
      dangerSoft: '#C77A6A22',
    },
    latte: {
      primarySoft: '#DDB28722',
      warningSoft: '#E8A24A22',
      dangerSoft: '#D6787822',
    },
    citrus: {
      primarySoft: '#B5D08622',
      warningSoft: '#E8A24A22',
      dangerSoft: '#D6787822',
    },
    pastel: {
      primarySoft: '#F79B8D22',
      warningSoft: '#E8A24A22',
      dangerSoft: '#D6787822',
    },
    indigo: {
      primarySoft: '#7FC2DE22',
      warningSoft: '#E8A24A22',
      dangerSoft: '#D6787822',
    },
  },
  DarkThemes: {
    cozy: {
      primarySoft: '#93BE9322',
      warningSoft: '#EDB06122',
      dangerSoft: '#E08D8D22',
    },
    forest: {
      primarySoft: '#7FBC8B22',
      warningSoft: '#EDB06122',
      dangerSoft: '#E08D8D22',
    },
    hanok: {
      primarySoft: '#C4A16F22',
      warningSoft: '#DCA85522',
      dangerSoft: '#DA938422',
    },
    latte: {
      primarySoft: '#C4A07B22',
      warningSoft: '#EDB06122',
      dangerSoft: '#E08D8D22',
    },
    citrus: {
      primarySoft: '#93B65D22',
      warningSoft: '#EDB06122',
      dangerSoft: '#E08D8D22',
    },
    pastel: {
      primarySoft: '#F8AB9F22',
      warningSoft: '#EDB06122',
      dangerSoft: '#E08D8D22',
    },
    indigo: {
      primarySoft: '#65B2D222',
      warningSoft: '#EDB06122',
      dangerSoft: '#E08D8D22',
    },
  },
};

describe('theme soft tints', () => {
  it('withAlpha appends the alpha byte to a 6-digit hex', () => {
    expect(withAlpha('#7FA87F', '22')).toBe('#7FA87F22');
  });

  it('light themes keep the previous soft literals', () => {
    for (const [id, soft] of Object.entries(PREVIOUS_LITERALS.Themes)) {
      const c = Themes[id as keyof typeof Themes];
      expect({
        primarySoft: c.primarySoft,
        warningSoft: c.warningSoft,
        dangerSoft: c.dangerSoft,
      }).toEqual(soft);
    }
  });

  it('dark themes keep the previous soft literals', () => {
    for (const [id, soft] of Object.entries(PREVIOUS_LITERALS.DarkThemes)) {
      const c = DarkThemes[id as keyof typeof DarkThemes];
      expect({
        primarySoft: c.primarySoft,
        warningSoft: c.warningSoft,
        dangerSoft: c.dangerSoft,
      }).toEqual(soft);
    }
  });

  it('soft tints follow their base colour', () => {
    for (const c of [...Object.values(Themes), ...Object.values(DarkThemes)]) {
      expect(c.primarySoft).toBe(withAlpha(c.primary, '22'));
      expect(c.warningSoft).toBe(withAlpha(c.warning, '22'));
      expect(c.dangerSoft).toBe(withAlpha(c.danger, '22'));
    }
  });
});
