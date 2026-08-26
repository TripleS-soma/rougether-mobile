/**
 * Flat vector pictograms replacing the emoji placeholders (#236). Hand-drawn
 * on a 24×24 grid; colors come from the active brand theme via `useTokens()`,
 * so they follow theme switches and dark mode — emoji never could. Single-tone
 * marks accept a `color` override for use on colored surfaces (e.g. a filled
 * button); the multi-tone ones ignore it.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTokens } from '@/hooks/use-tokens';

export type PictogramName =
  | 'sprout'
  | 'checklist'
  | 'house'
  | 'friends'
  | 'thumb-up'
  | 'heart'
  | 'sparkle'
  | 'crown'
  | 'target'
  | 'mission-flag'
  | 'sun'
  | 'calendar'
  | 'book'
  | 'book-open'
  | 'dumbbell'
  | 'palette'
  | 'water'
  | 'run'
  | 'music'
  | 'cooking'
  | 'meditation'
  | 'briefcase'
  | 'handshake'
  | 'lock'
  | 'globe'
  | 'moon'
  | 'coffee'
  | 'sunrise'
  | 'laptop'
  | 'gift'
  | 'paw'
  | 'pencil'
  | 'door'
  | 'leaf'
  | 'croissant'
  | 'pagoda'
  | 'teddy'
  | 'planet'
  | 'blossom';

export type PictogramProps = {
  size?: number;
  /** Override for single-tone marks (e.g. `onPrimary` on a filled button). */
  color?: string;
};

export function CrownPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9 L7.2 12 L12 6.5 L16.8 12 L20 9 L18.4 17.2 Q18.2 18.2 17.2 18.2 L6.8 18.2 Q5.8 18.2 5.6 17.2 Z"
        fill={c}
      />
      <Circle cx={4} cy={8} r={1.6} fill={c} />
      <Circle cx={12} cy={5.6} r={1.6} fill={c} />
      <Circle cx={20} cy={8} r={1.6} fill={c} />
    </Svg>
  );
}

export function TargetPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.danger;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={2.4} />
      <Circle cx={12} cy={12} r={4.6} stroke={c} strokeWidth={2.4} />
      <Circle cx={12} cy={12} r={1.5} fill={c} />
    </Svg>
  );
}

/**
 * 온보딩 미션 배너의 진행 표식 (#571) — 목표 지점에 꽂힌 깃발. 🎯 이모지를
 * 대체한다: 이모지는 플랫폼마다 다른 그림이 나오고 테마를 못 따라가는데,
 * 이 마크는 깃대가 `text`, 깃발이 `warning`이라 라이트/다크에서 함께 뒤집힌다.
 *
 * 아래 접힘은 새 색을 만들지 않고 `onTint`(라이트·다크 동일한 고정 잉크)를
 * 18%로 덮어 어둡게 한다 — 어느 테마의 warning 위에서도 같은 만큼 진해진다.
 * 22px(배너 실제 크기)에서 형태가 뭉개지지 않는 선까지만 디테일을 둔다.
 */
export function MissionFlagPictogram({ size = 24 }: PictogramProps) {
  const t = useTokens();
  const wave = 'M6.8 11.6 Q11.4 9.8 15.3 11.8 Q18 13.2 19.8 12.2 L19.8 13.8 Q18 14.8 15.3 13.4 Q11.4 11.4 6.8 13.2 Z'; // prettier-ignore
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID="mission-flag">
      <Path d="M5.4 3.2 V20.8" stroke={t.text} strokeWidth={2.2} strokeLinecap="round" />
      <Path
        d="M6.8 4.2 Q11.4 2.4 15.3 4.4 Q18 5.8 19.8 4.8 L19.8 12.2 Q18 13.2 15.3 11.8 Q11.4 9.8 6.8 11.6 Z"
        fill={t.warning}
      />
      <Path d={wave} fill={t.warning} />
      <Path d={wave} fill={t.onTint} opacity={0.18} />
    </Svg>
  );
}

function SproutPictogram({ size = 24 }: PictogramProps) {
  const t = useTokens();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21 V11" stroke={t.primaryActive} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M12 12 Q12 6.5 6.5 5.5 Q6 11 12 12 Z" fill={t.primaryActive} />
      <Path d="M12 9.5 Q12.5 5 17.5 4 Q17.5 9 12 9.8 Z" fill={t.primary} />
    </Svg>
  );
}

function ChecklistPictogram({ size = 24 }: PictogramProps) {
  const t = useTokens();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={16} rx={4} fill={t.primary} />
      <Path
        d="M8.4 12.2 L11 14.8 L15.8 9.6"
        stroke={t.onPrimary}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HousePictogram({ size = 24 }: PictogramProps) {
  const t = useTokens();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.6 L20 10 V19 Q20 20 19 20 L5 20 Q4 20 4 19 L4 10 Z"
        fill={t.warning}
        fillOpacity={0.25}
      />
      <Path
        d="M12 3.6 L20 10 V19 Q20 20 19 20 L5 20 Q4 20 4 19 L4 10 Z"
        stroke={t.warning}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Rect x={9.6} y={13} width={4.8} height={7} rx={1} fill={t.warning} />
    </Svg>
  );
}

function FriendsPictogram({ size = 24 }: PictogramProps) {
  const t = useTokens();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8.4} cy={8.6} r={3.4} fill={t.primary} />
      <Path d="M2.6 19.4 Q2.6 13.8 8.4 13.8 Q14.2 13.8 14.2 19.4 Z" fill={t.primary} />
      <Circle cx={16.4} cy={9.4} r={2.8} fill={t.warning} />
      <Path d="M12.9 19.4 Q13.4 15 16.4 15 Q21.4 15 21.4 19.4 Z" fill={t.warning} />
    </Svg>
  );
}

function ThumbUpPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.5 10.5 L10.8 4.2 Q11 3.4 11.8 3.4 Q13.6 3.4 13.6 5.4 L13.2 8.6 L18.6 8.6 Q20.4 8.6 20 10.6 L18.6 17.6 Q18.3 19 16.9 19 L7.5 19 Z"
        fill={c}
      />
      <Rect x={3.4} y={10.2} width={3} height={8.8} rx={1.2} fill={c} fillOpacity={0.55} />
    </Svg>
  );
}

function HeartPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20 Q4 14.6 4 9.4 Q4 5.8 7.2 5.8 Q10 5.8 12 8.6 Q14 5.8 16.8 5.8 Q20 5.8 20 9.4 Q20 14.6 12 20 Z"
        fill={c}
      />
    </Svg>
  );
}

export function SparklePictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 Q13 9.4 19.4 10.5 Q13 11.6 12 18 Q11 11.6 4.6 10.5 Q11 9.4 12 3 Z" fill={c} />
      <Path
        d="M18.6 15.4 Q19 17.6 21.2 18 Q19 18.4 18.6 20.6 Q18.2 18.4 16 18 Q18.2 17.6 18.6 15.4 Z"
        fill={c}
        fillOpacity={0.7}
      />
    </Svg>
  );
}

function SunPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rays.push(
      <Path
        key={i}
        d={`M${12 + Math.cos(a) * 7.4} ${12 + Math.sin(a) * 7.4} L${12 + Math.cos(a) * 9.8} ${12 + Math.sin(a) * 9.8}`}
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4.4} fill={c} />
      {rays}
    </Svg>
  );
}

function CalendarPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5.6} width={16} height={14.4} rx={2.4} stroke={c} strokeWidth={2} />
      <Path d="M4.6 10 L19.4 10" stroke={c} strokeWidth={2} />
      <Path d="M8.4 3.4 V7" stroke={c} strokeWidth={2} strokeLinecap="round" />
      <Path d="M15.6 3.4 V7" stroke={c} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={9} cy={14} r={1.3} fill={c} />
      <Circle cx={13.5} cy={14} r={1.3} fill={c} />
    </Svg>
  );
}

function BookPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3.6 Q4.4 3.6 4.4 5.2 L4.4 18.4 Q4.4 20.4 6.4 20.4 L19.6 20.4 L19.6 17.4"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M7 3.6 L19.6 3.6 L19.6 17.2 L7 17.2 Q4.4 17.2 4.4 18.4"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M9.6 8 L15.6 8" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function BookOpenPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 6.4 Q9 4.4 4 4.8 L4 18 Q9 17.6 12 19.6 Q15 17.6 20 18 L20 4.8 Q15 4.4 12 6.4 Z"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M12 6.4 L12 19.6" stroke={c} strokeWidth={2} />
    </Svg>
  );
}

function DumbbellPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.danger;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 12 L16 12" stroke={c} strokeWidth={2.4} />
      <Rect x={4.6} y={7.6} width={3.2} height={8.8} rx={1.2} fill={c} />
      <Rect x={16.2} y={7.6} width={3.2} height={8.8} rx={1.2} fill={c} />
      <Rect x={2} y={9.6} width={2} height={4.8} rx={1} fill={c} fillOpacity={0.6} />
      <Rect x={20} y={9.6} width={2} height={4.8} rx={1} fill={c} fillOpacity={0.6} />
    </Svg>
  );
}

function PalettePictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.6 Q20.4 3.6 20.4 11 Q20.4 15.4 16.4 15.4 L14 15.4 Q12.6 15.4 12.6 16.8 Q12.6 17.6 13.2 18.2 Q13.8 20.4 11.6 20.4 Q3.6 19.6 3.6 12 Q3.6 3.6 12 3.6 Z"
        stroke={c}
        strokeWidth={2}
      />
      <Circle cx={8.6} cy={9} r={1.4} fill={color ?? t.danger} />
      <Circle cx={13.4} cy={7.6} r={1.4} fill={color ?? t.warning} />
      <Circle cx={7.6} cy={13.6} r={1.4} fill={color ?? t.primary} />
    </Svg>
  );
}

function WaterPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.6 Q18.6 11 18.6 14.8 Q18.6 20.4 12 20.4 Q5.4 20.4 5.4 14.8 Q5.4 11 12 3.6 Z"
        fill={c}
        fillOpacity={0.85}
      />
      <Path
        d="M9 14.6 Q9 17 11 17.6"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.85}
      />
    </Svg>
  );
}

function RunPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.success;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={14.6} cy={5.4} r={2.2} fill={c} />
      <Path
        d="M8.2 9.6 L12.6 8.4 L15 12 L18.6 13"
        stroke={c}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12.6 8.4 L11 13.6 L14 16.4 L13 20.4"
        stroke={c}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11 13.6 L7.6 15.6 L5.4 19"
        stroke={c}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MusicPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.4 17.4 L9.4 5.4 L18.6 3.6 L18.6 15.6"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={6.8} cy={17.6} r={2.8} fill={c} />
      <Circle cx={16} cy={15.8} r={2.8} fill={c} />
    </Svg>
  );
}

function CookingPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10} cy={13.6} r={6.4} stroke={c} strokeWidth={2} />
      <Circle cx={10} cy={13.6} r={2.2} fill={c} fillOpacity={0.5} />
      <Path d="M16 9.4 L21 4.4" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function MeditationPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 8 Q14.6 11.4 12 15.4 Q9.4 11.4 12 8 Z" fill={c} />
      <Path d="M5.4 12.4 Q9.6 12.6 11.2 15.8 Q6.4 16.6 5.4 12.4 Z" fill={c} fillOpacity={0.7} />
      <Path d="M18.6 12.4 Q14.4 12.6 12.8 15.8 Q17.6 16.6 18.6 12.4 Z" fill={c} fillOpacity={0.7} />
      <Path d="M6.4 18.6 Q12 20.8 17.6 18.6" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function BriefcasePictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.6} y={7.6} width={16.8} height={12} rx={2.4} stroke={c} strokeWidth={2} />
      <Path d="M9 7.2 Q9 4.4 12 4.4 Q15 4.4 15 7.2" stroke={c} strokeWidth={2} />
      <Path d="M3.8 12.4 L20.2 12.4" stroke={c} strokeWidth={1.8} />
    </Svg>
  );
}

function HandshakePictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.6 9 L8.4 6.6 L13 9.6 Q14 10.4 13 11.4 Q12 12.2 11 11.4 L8.8 9.8"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.4 9.4 L16 7.2 L13 9.6"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 12 L9.4 15.4 Q10.4 16.4 11.4 15.6 M8.6 14 L11.6 17 Q12.6 18 13.6 17.2 M11.4 15.6 L13 17 M13.6 17.2 L16.6 14.4 L20.4 12.4"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LockPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5.4} y={10.4} width={13.2} height={9.6} rx={2.4} fill={c} />
      <Path
        d="M8.4 10 L8.4 8 Q8.4 4.4 12 4.4 Q15.6 4.4 15.6 8 L15.6 10"
        stroke={c}
        strokeWidth={2.2}
        fill="none"
      />
      <Circle cx={12} cy={14.6} r={1.4} fill={t.surface} />
    </Svg>
  );
}

function GlobePictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.4} stroke={c} strokeWidth={2} />
      <Path
        d="M3.8 12 L20.2 12 M12 3.8 Q16.4 8 16.4 12 Q16.4 16 12 20.2 M12 3.8 Q7.6 8 7.6 12 Q7.6 16 12 20.2"
        stroke={c}
        strokeWidth={1.8}
        fill="none"
      />
    </Svg>
  );
}

function MoonPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 3.8 Q9 5.6 9 11.4 Q9 17.4 15.4 19 Q12.4 20.8 9.2 19.8 Q3.8 18 3.8 12 Q3.8 6 9.6 4.2 Q11.8 3.5 14 3.8 Z"
        fill={c}
      />
      <Circle cx={17.4} cy={7} r={1.2} fill={c} fillOpacity={0.6} />
    </Svg>
  );
}

function CoffeePictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.4 9.4 L16.4 9.4 L16.4 15.4 Q16.4 19.6 10.4 19.6 Q4.4 19.6 4.4 15.4 Z"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M16.6 11 Q20.2 11 20.2 13.4 Q20.2 15.8 16.4 15.6"
        stroke={c}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d="M8.4 4 Q9.4 5.4 8.4 6.8 M12.4 4 Q13.4 5.4 12.4 6.8"
        stroke={c}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function SunrisePictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 16 Q7 11 12 11 Q17 11 17 16 Z" fill={c} />
      <Path
        d="M12 4.4 L12 7.4 M5 8 L7 10 M19 8 L17 10"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M3.6 16 L20.4 16 M6.6 19.4 L17.4 19.4"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function LaptopPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5.4} y={5.4} width={13.2} height={9.2} rx={1.6} stroke={c} strokeWidth={2} />
      <Path
        d="M3 18.6 L21 18.6 Q21.6 18.6 21.4 18 L20.6 15.8 Q20.4 15.2 19.8 15.2 L4.2 15.2 Q3.6 15.2 3.4 15.8 L2.6 18 Q2.4 18.6 3 18.6 Z"
        fill={c}
      />
    </Svg>
  );
}

function GiftPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.danger;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4.4} y={9.5} width={15.2} height={10.5} rx={2} fill={c} fillOpacity={0.75} />
      <Rect x={3.4} y={6.5} width={17.2} height={4} rx={1.6} fill={c} />
      <Rect x={10.8} y={6.5} width={2.4} height={13.5} fill={t.surface} />
      <Path
        d="M12 6 Q9 6 8.6 4.4 Q8.4 2.8 10 2.8 Q11.8 2.8 12 6 Q12.2 2.8 14 2.8 Q15.6 2.8 15.4 4.4 Q15 6 12 6 Z"
        fill={c}
      />
    </Svg>
  );
}

export function PawPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 11.4 Q15.4 11.4 17 14.6 Q18.6 17.8 16.4 19.2 Q14.8 20.2 12 19 Q9.2 20.2 7.6 19.2 Q5.4 17.8 7 14.6 Q8.6 11.4 12 11.4 Z"
        fill={c}
      />
      <Circle cx={6.6} cy={10} r={1.9} fill={c} />
      <Circle cx={10.2} cy={7.4} r={1.9} fill={c} />
      <Circle cx={13.8} cy={7.4} r={1.9} fill={c} />
      <Circle cx={17.4} cy={10} r={1.9} fill={c} />
    </Svg>
  );
}

export function PencilPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.6 5.4 L18.6 9.4 L8.6 19.4 L4 20 L4.6 15.4 Z"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M16.4 3.6 Q17.4 2.6 18.4 3.6 L20.4 5.6 Q21.4 6.6 20.4 7.6 L18.6 9.4 L14.6 5.4 Z"
        fill={c}
      />
    </Svg>
  );
}

export function TrashPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.danger;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.4 7.4 L7.4 19.6 Q7.5 20.6 8.5 20.6 L15.5 20.6 Q16.5 20.6 16.6 19.6 L17.6 7.4"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M4.6 6.4 L19.4 6.4" stroke={c} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M9.6 6 Q9.6 3.8 12 3.8 Q14.4 3.8 14.4 6"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M10 10.2 L10.3 17 M14 10.2 L13.7 17"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function DoorPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.danger;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13.4 4 L13.4 20 M13.4 4 L20 4 L20 20 L13.4 20"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M4 12 L11 12 M8.4 8.8 L11.4 12 L8.4 15.2"
        stroke={c}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function LeafPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.success;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.4 4.6 Q8.4 4.6 5.6 12 Q4 16.6 5.8 19 Q7.6 16 11.4 15 Q17.6 13.2 19.4 4.6 Z"
        fill={c}
      />
      <Path
        d="M6.6 18 Q10 11 16 8"
        stroke={t.surface}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
    </Svg>
  );
}

function CroissantPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 16.4 Q4 9 12 9 Q20 9 20 16.4 Q16.6 14.4 12 14.4 Q7.4 14.4 4 16.4 Z" fill={c} />
      <Path d="M4 16.4 Q5.6 12 8.4 10 L8.4 14.8 Q6 15.4 4 16.4 Z" fill={c} fillOpacity={0.7} />
      <Path
        d="M20 16.4 Q18.4 12 15.6 10 L15.6 14.8 Q18 15.4 20 16.4 Z"
        fill={c}
        fillOpacity={0.7}
      />
    </Svg>
  );
}

function PagodaPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.danger;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 Q13 5.4 17 6.6 L7 6.6 Q11 5.4 12 3 Z" fill={c} />
      <Path d="M5 11.4 Q8 9.8 8.6 7 L15.4 7 Q16 9.8 19 11.4 Z" fill={c} fillOpacity={0.85} />
      <Path
        d="M3.6 16.2 Q7.4 14.4 8 11.8 L16 11.8 Q16.6 14.4 20.4 16.2 Z"
        fill={c}
        fillOpacity={0.7}
      />
      <Rect x={9.4} y={16.6} width={5.2} height={3.8} rx={0.8} fill={c} />
    </Svg>
  );
}

function TeddyPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6.6} cy={6.6} r={2.6} fill={c} />
      <Circle cx={17.4} cy={6.6} r={2.6} fill={c} />
      <Circle cx={12} cy={12.4} r={7.6} fill={c} fillOpacity={0.9} />
      <Circle cx={9.4} cy={11} r={1.1} fill={t.surface} />
      <Circle cx={14.6} cy={11} r={1.1} fill={t.surface} />
      <Path
        d="M10.4 15 Q12 16.4 13.6 15"
        stroke={t.surface}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function PlanetPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={5.8} fill={c} />
      <Path
        d="M3.4 14.8 Q7 17.6 12.6 16.4 Q18.2 15.2 20.6 11.4 M3.4 14.8 Q2.2 13 4.6 11.6 M20.6 11.4 Q22 9.8 19.6 8.8"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      />
    </Svg>
  );
}

function BlossomPictogram({ size = 24, color }: PictogramProps) {
  const t = useTokens();
  const c = color ?? t.danger;
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    petals.push(
      <Circle
        key={i}
        cx={12 + Math.cos(a) * 4.6}
        cy={12 + Math.sin(a) * 4.6}
        r={3.4}
        fill={c}
        fillOpacity={0.8}
      />,
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {petals}
      <Circle cx={12} cy={12} r={2.4} fill={t.warning} />
    </Svg>
  );
}

const PICTOGRAMS: Record<PictogramName, (p: PictogramProps) => React.JSX.Element> = {
  sprout: SproutPictogram,
  checklist: ChecklistPictogram,
  house: HousePictogram,
  friends: FriendsPictogram,
  'thumb-up': ThumbUpPictogram,
  heart: HeartPictogram,
  sparkle: SparklePictogram,
  crown: CrownPictogram,
  target: TargetPictogram,
  'mission-flag': MissionFlagPictogram,
  sun: SunPictogram,
  calendar: CalendarPictogram,
  book: BookPictogram,
  'book-open': BookOpenPictogram,
  dumbbell: DumbbellPictogram,
  palette: PalettePictogram,
  water: WaterPictogram,
  run: RunPictogram,
  music: MusicPictogram,
  cooking: CookingPictogram,
  meditation: MeditationPictogram,
  briefcase: BriefcasePictogram,
  handshake: HandshakePictogram,
  lock: LockPictogram,
  globe: GlobePictogram,
  moon: MoonPictogram,
  coffee: CoffeePictogram,
  sunrise: SunrisePictogram,
  laptop: LaptopPictogram,
  gift: GiftPictogram,
  paw: PawPictogram,
  pencil: PencilPictogram,
  door: DoorPictogram,
  leaf: LeafPictogram,
  croissant: CroissantPictogram,
  pagoda: PagodaPictogram,
  teddy: TeddyPictogram,
  planet: PlanetPictogram,
  blossom: BlossomPictogram,
};

/** Is this string a known pictogram name? (server iconKeys round-trip as names) */
export function isPictogramName(key: string): key is PictogramName {
  return key in PICTOGRAMS;
}

/** Name-keyed dispatcher for data-driven uses (slides, cheer buttons, missions). */
export function Pictogram({ name, ...props }: { name: PictogramName } & PictogramProps) {
  const Mark = PICTOGRAMS[name];
  return <Mark {...props} />;
}
