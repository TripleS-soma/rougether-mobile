import Svg, { Circle, Ellipse } from 'react-native-svg';

import { useTokens } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';

export type CoinIconProps = {
  size?: number;
  /** 동전 면 색 — 기본은 테마 warning 골드 (호출부 관례와 동일). */
  color?: string;
};

/**
 * 발바닥 각인 동전 (#512, 시안 B) — Ionicons에 동전형 글리프가 없어 민무늬
 * 원(ellipse)으로 그리던 코인을 대체하는 커스텀 글리프. 완료 체크(BearCheck)의
 * 곰 발바닥을 화폐에 각인해 "발바닥을 모아 코인을 번다"로 세계관을 잇는다.
 * 테두리·각인은 warningText 계열이라 5개 테마·다크 모드에 자동 대응하고,
 * 14px 미만에선 발가락을 1개로 줄여 축소 내성을 확보한다.
 */
export function CoinIcon({ size = 22, color }: CoinIconProps) {
  const t = useTokens();
  const fill = color ?? t.warning;
  // 다크 팔레트는 warning == warningText라 각인이 면에 묻힌다 — 면 색과의
  // 대비를 강제해 어느 테마에서든 발바닥이 보이게 한다.
  const engrave = readableTextColor(t.warningText, fill, 3);
  const tiny = size < 14;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="coin-icon">
      <Circle cx={12} cy={12} r={10.4} fill={fill} stroke={engrave} strokeWidth={1.7} />
      {tiny ? (
        <>
          <Ellipse cx={12} cy={13.9} rx={3.4} ry={2.7} fill={engrave} opacity={0.9} />
          <Circle cx={12} cy={9} r={1.5} fill={engrave} opacity={0.9} />
        </>
      ) : (
        <>
          <Ellipse cx={12} cy={14.1} rx={3.2} ry={2.5} fill={engrave} opacity={0.9} />
          <Circle cx={12} cy={9.3} r={1.35} fill={engrave} opacity={0.9} />
          <Circle cx={8.6} cy={10.7} r={1.2} fill={engrave} opacity={0.9} />
          <Circle cx={15.4} cy={10.7} r={1.2} fill={engrave} opacity={0.9} />
        </>
      )}
    </Svg>
  );
}
