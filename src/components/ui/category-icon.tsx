import Svg, { Path } from 'react-native-svg';

import { StaticWhite } from '@/constants/theme';
import { Pictogram, type PictogramName } from '@/components/ui/pictograms';
import { useTokens } from '@/hooks/use-tokens';

/**
 * 카테고리 아이콘 — 스티커 팝 스타일 (#398, design-sync Category icons revamp
 * A안 채택). 24×24 지오메트리에 파스텔 필 + 잉크 윤곽 + surface색 스티커
 * 테두리를 입힌다. 톤은 고정 팔레트가 아니라 **카테고리 색 하나에서 파생**
 * (파스텔 45%·액센트 10%·포인트 72% 백색 혼합)돼, 카테고리 색을 바꾸면
 * 아이콘도 같이 물든다. 카테고리 문맥 전용 — 미션·집 테마 등 다른 픽토그램
 * 용도는 기존 `Pictogram`을 그대로 쓴다.
 */

/** part 역할 → 톤: base(주 형태)=파스텔, accent(보조)=진한 톤, pop(포인트)=밝은 톤. */
type PartRole =
  'base' | 'base2' | 'accent' | 'accent2' | 'pop' | 'pop2' | 'line' | 'popline' | 'stemline';

type Part = { d: string; role: PartRole };

const P = (d: string, role: PartRole): Part => ({ d, role });

/** 카테고리 폼에서 고를 수 있는 16종 (ICON_CHOICES와 동일 집합). */
export const CATEGORY_ICON_GEOMETRY: Partial<Record<PictogramName, Part[]>> = {
  calendar: [
    P('M4 7.5 Q4 5.5 6 5.5 L18 5.5 Q20 5.5 20 7.5 L20 18 Q20 20 18 20 L6 20 Q4 20 4 18 Z', 'base'),
    P('M4 7.5 Q4 5.5 6 5.5 L18 5.5 Q20 5.5 20 7.5 L20 10 L4 10 Z', 'accent'),
    P('M8 3.4 L8 7 M16 3.4 L16 7', 'line'),
    P('M8 13.6 h3 M8 16.6 h6', 'popline'),
  ],
  book: [
    P(
      'M5 5.6 Q5 4 6.6 4 L17.4 4 Q19 4 19 5.6 L19 18.4 Q19 20 17.4 20 L6.6 20 Q5 20 5 18.4 Z',
      'base',
    ),
    P('M5 5.6 Q5 4 6.6 4 L8.6 4 L8.6 20 L6.6 20 Q5 20 5 18.4 Z', 'accent'),
    P('M13 4 L16.4 4 L16.4 10 L14.7 8.4 L13 10 Z', 'pop'),
  ],
  palette: [
    P(
      'M12 3.6 Q20.4 3.6 20.4 11 Q20.4 15 16.8 15 L14.8 15 Q13.4 15 13.4 16.4 Q13.4 17 13.9 17.7 Q14.5 18.6 13.8 19.6 Q13.2 20.4 12 20.4 Q3.6 20.4 3.6 12 Q3.6 3.6 12 3.6 Z',
      'base',
    ),
    P('M8.2 9.4 m-1.7 0 a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0', 'pop'),
    P('M13.4 7.4 m-1.7 0 a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0', 'accent'),
    P('M7.6 14.2 m-1.7 0 a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0', 'pop2'),
  ],
  dumbbell: [
    P(
      'M3.4 9.4 Q3.4 8.2 4.6 8.2 L6.2 8.2 Q7.4 8.2 7.4 9.4 L7.4 14.6 Q7.4 15.8 6.2 15.8 L4.6 15.8 Q3.4 15.8 3.4 14.6 Z',
      'base',
    ),
    P(
      'M16.6 9.4 Q16.6 8.2 17.8 8.2 L19.4 8.2 Q20.6 8.2 20.6 9.4 L20.6 14.6 Q20.6 15.8 19.4 15.8 L17.8 15.8 Q16.6 15.8 16.6 14.6 Z',
      'base2',
    ),
    P('M7.4 10.8 L16.6 10.8 L16.6 13.2 L7.4 13.2 Z', 'accent'),
  ],
  sparkle: [
    P('M12 3 Q13.4 9.4 21 12 Q13.4 14.6 12 21 Q10.6 14.6 3 12 Q10.6 9.4 12 3 Z', 'base'),
    P(
      'M18.4 3.4 Q18.9 5.6 21 6.4 Q18.9 7.2 18.4 9.4 Q17.9 7.2 15.8 6.4 Q17.9 5.6 18.4 3.4 Z',
      'pop',
    ),
  ],
  sun: [
    P('M12 6.6 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0', 'base'),
    P(
      'M12 14.4 Q12 16 12 17.4 M5.6 8.5 L4 7.4 M18.4 8.5 L20 7.4 M6.4 13.4 L4.7 14.6 M17.6 13.4 L19.3 14.6',
      'line',
    ),
    P('M6 19.4 Q12 16.4 18 19.4', 'popline'),
  ],
  moon: [
    P(
      'M13.6 3.8 Q9.4 6.2 9.4 11 Q9.4 15.8 13.6 18.2 Q11.8 19 10 19 Q3.6 19 3.6 11.9 Q3.6 4.8 10 4.8 Q11.9 4.8 13.6 3.8 Z',
      'base',
    ),
    P('M17.4 6.2 Q17.8 8 19.6 8.4 Q17.8 8.8 17.4 10.6 Q17 8.8 15.2 8.4 Q17 8 17.4 6.2 Z', 'pop'),
    P(
      'M19.4 13.4 Q19.7 14.6 20.8 14.9 Q19.7 15.2 19.4 16.4 Q19.1 15.2 18 14.9 Q19.1 14.6 19.4 13.4 Z',
      'accent',
    ),
  ],
  water: [
    P(
      'M12 3.4 Q18.6 10.4 18.6 14.6 Q18.6 20.4 12 20.4 Q5.4 20.4 5.4 14.6 Q5.4 10.4 12 3.4 Z',
      'base',
    ),
    P('M9 14.2 Q8.6 17 10.8 17.9', 'popline'),
  ],
  run: [
    P(
      'M4 15.4 Q4.4 13 7 12.4 L9.6 11.8 Q10.8 11.5 11.8 12.4 L13.6 14 L19 14.6 Q20.6 14.9 20.6 16.5 Q20.6 18.4 18.4 18.4 L6 18.4 Q4 18.4 4 16.4 Z',
      'base',
    ),
    P('M4 16.6 L20.6 16.6 L20.6 16.5 Q20.6 18.4 18.4 18.4 L6 18.4 Q4 18.4 4 16.6 Z', 'accent'),
    P('M9.2 11.9 L10.4 14.2 M12 12.6 L12.8 14.1', 'line'),
    P('M5.4 8.4 h3.4 M4 10.6 h3.4', 'popline'),
  ],
  heart: [
    P(
      'M12 20 Q4 15 4 9.6 Q4 5.6 7.6 5.6 Q10.2 5.6 12 8.2 Q13.8 5.6 16.4 5.6 Q20 5.6 20 9.6 Q20 15 12 20 Z',
      'base',
    ),
    P('M7.4 8.4 Q8.8 7.6 10 8.8', 'popline'),
  ],
  coffee: [
    P('M4.6 9 L17 9 L16.4 17.6 Q16.2 20 13.8 20 L7.8 20 Q5.4 20 5.2 17.6 Z', 'base'),
    P(
      'M17 10.4 Q20.2 10.4 20.2 13 Q20.2 15.6 16.6 15.6 L16.8 13.6 Q18.2 13.6 18.2 13 Q18.2 12.4 16.9 12.4 Z',
      'accent',
    ),
    P('M8.4 3.6 Q7.8 5 8.8 6.4 M12.4 3.6 Q11.8 5 12.8 6.4', 'line'),
  ],
  music: [
    P('M9.6 18.4 m-2.8 0 a2.8 2.8 0 1 0 5.6 0 a2.8 2.8 0 1 0 -5.6 0', 'base'),
    P('M18 15.4 m-2.4 0 a2.4 2.4 0 1 0 4.8 0 a2.4 2.4 0 1 0 -4.8 0', 'accent'),
    P(
      'M12.4 18.4 L12.4 6.4 Q12.4 5.2 13.6 5 L19.2 3.8 Q20.4 3.6 20.4 4.8 L20.4 15.4 L18.4 15.4 L18.4 7.4 L14.4 8.3 L14.4 18.4 Z',
      'pop',
    ),
  ],
  cooking: [
    P('M4 11 L16.6 11 Q16.6 17.8 10.3 17.8 Q4 17.8 4 11 Z', 'base'),
    P('M16.6 11.8 L20.4 10 Q21 12 18.4 13.2 L16.4 14 Z', 'accent'),
    P('M10.3 5.2 m-2.2 0 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0', 'pop'),
    P('M6.4 19.8 h7.8', 'line'),
  ],
  meditation: [
    P(
      'M12 4.4 Q14.6 7.4 14.6 10.2 Q14.6 13.4 12 14.6 Q9.4 13.4 9.4 10.2 Q9.4 7.4 12 4.4 Z',
      'base',
    ),
    P('M5 9.4 Q8.4 9.8 9.8 12.6 Q10.8 14.8 9.4 17 Q5.4 15 5 9.4 Z', 'accent'),
    P('M19 9.4 Q15.6 9.8 14.2 12.6 Q13.2 14.8 14.6 17 Q18.6 15 19 9.4 Z', 'accent2'),
    P('M8.4 19.6 Q12 21.2 15.6 19.6', 'popline'),
  ],
  briefcase: [
    P(
      'M3.6 9.6 Q3.6 7.6 5.6 7.6 L18.4 7.6 Q20.4 7.6 20.4 9.6 L20.4 17.4 Q20.4 19.4 18.4 19.4 L5.6 19.4 Q3.6 19.4 3.6 17.4 Z',
      'base',
    ),
    P(
      'M9 7.6 L9 6.2 Q9 4.6 10.6 4.6 L13.4 4.6 Q15 4.6 15 6.2 L15 7.6 L13 7.6 L13 6.6 L11 6.6 L11 7.6 Z',
      'accent',
    ),
    P('M3.6 12 L20.4 12 M12 10.8 L12 13.4', 'line'),
  ],
  sprout: [
    P('M12 20.4 L12 11.4', 'stemline'),
    P('M12 12.6 Q11.4 7 5.6 6.2 Q5 12.4 12 12.6 Z', 'base'),
    P('M12.2 10.4 Q13.2 5.8 18.4 5.4 Q18.6 10.8 12.2 10.4 Z', 'accent'),
    P('M8.4 20.4 h7.2', 'popline'),
  ],
};

/** `hex`를 `to` 쪽으로 pct(0~1)만큼 혼합. */
function mix(hex: string, pct: number, to: string = StaticWhite): string {
  const ch = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const [r1, g1, b1] = ch(hex);
  const [r2, g2, b2] = ch(to);
  const c = (a: number, b: number) =>
    Math.round(a + (b - a) * pct)
      .toString(16)
      .padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

const isLine = (role: PartRole) => role.includes('line');

export type CategoryIconProps = {
  name: PictogramName;
  /** 카테고리 색 — 파스텔/액센트/포인트 톤이 여기서 파생된다. */
  color: string;
  size?: number;
  /**
   * 색 채움 위(활성 칩 등) 단색 모드 — 윤곽·라인만 이 색으로 그린다.
   * 파스텔 필은 배경색과 섞여 뭉개지므로 채움 없이 형태만 남긴다.
   */
  mono?: string;
};

export function CategoryIcon({ name, color, size = 24, mono }: CategoryIconProps) {
  const t = useTokens();
  const parts = CATEGORY_ICON_GEOMETRY[name];
  // 16종 밖 아이콘(집 카테고리 'house' 등 레거시) — 기존 픽토그램으로 폴백.
  if (!parts) return <Pictogram name={name} size={size} color={mono} />;

  const ink = mono ?? t.onTint;
  const fillFor = (role: PartRole) =>
    role === 'base' || role === 'base2'
      ? mix(color, 0.45)
      : role === 'accent' || role === 'accent2'
        ? mix(color, 0.1)
        : mix(color, 0.72);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      testID={`category-icon-${name}`}>
      {/* 스티커 테두리 — surface색 굵은 테를 먼저 깔아 실루엣 가장자리를 띄운다. */}
      {mono
        ? null
        : parts.map(({ d }, i) => (
            <Path
              key={`edge-${i}`}
              d={d}
              fill="none"
              stroke={t.surface}
              strokeWidth={4.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
      {parts.map(({ d, role }, i) =>
        isLine(role) ? (
          <Path key={i} d={d} fill="none" stroke={ink} strokeWidth={1.7} strokeLinecap="round" />
        ) : (
          <Path
            key={i}
            d={d}
            fill={mono ? 'none' : fillFor(role)}
            stroke={ink}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        ),
      )}
    </Svg>
  );
}
