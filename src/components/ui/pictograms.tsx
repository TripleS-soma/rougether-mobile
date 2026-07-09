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
  | 'sun'
  | 'calendar';

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

export function SproutPictogram({ size = 24 }: PictogramProps) {
  const t = useTokens();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21 V11" stroke={t.primaryActive} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M12 12 Q12 6.5 6.5 5.5 Q6 11 12 12 Z" fill={t.primaryActive} />
      <Path d="M12 9.5 Q12.5 5 17.5 4 Q17.5 9 12 9.8 Z" fill={t.primary} />
    </Svg>
  );
}

export function ChecklistPictogram({ size = 24 }: PictogramProps) {
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

export function FriendsPictogram({ size = 24 }: PictogramProps) {
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

export function ThumbUpPictogram({ size = 24, color }: PictogramProps) {
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

export function HeartPictogram({ size = 24, color }: PictogramProps) {
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

export function SunPictogram({ size = 24, color }: PictogramProps) {
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

export function CalendarPictogram({ size = 24, color }: PictogramProps) {
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
  sun: SunPictogram,
  calendar: CalendarPictogram,
};

/** Name-keyed dispatcher for data-driven uses (slides, cheer buttons, missions). */
export function Pictogram({ name, ...props }: { name: PictogramName } & PictogramProps) {
  const Mark = PICTOGRAMS[name];
  return <Mark {...props} />;
}
