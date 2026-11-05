import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * 리디자인 집 그림의 위쪽 경계를 하늘색으로 녹인다 (#1649).
 *
 * 집 그림(2:3)은 하늘까지 그려진 한 장인데, 화면이 그보다 길면 그림 위로 단색
 * `skyColor`가 남는다. 그림 맨 윗줄엔 구름·나뭇잎이 걸려 있어 그 경계가 사진을 자른
 * 듯한 직선으로 보였다 — 레벨·멤버 알약이 바로 그 띠 위에 떠서 더 도드라졌다.
 * 그림 위쪽 일부를 `skyColor` → 투명으로 덮어 단색 띠와 그림을 이어 붙인다.
 */
export function DioramaTopFade({ color }: { color: string }) {
  return (
    <View style={styles.fade} pointerEvents="none" testID="diorama-top-fade">
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="dioramaTopFade" x1="0" y1="0" x2="0" y2="1">
            {/* (1 - t)^1.4 — 위는 거의 단색, 아래로 갈수록 빨리 걷힌다. */}
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.25" stopColor={color} stopOpacity={0.67} />
            <Stop offset="0.5" stopColor={color} stopOpacity={0.38} />
            <Stop offset="0.75" stopColor={color} stopOpacity={0.14} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill="url(#dioramaTopFade)" />
      </Svg>
    </View>
  );
}

/**
 * 그림 높이 대비 덮는 비율 — 맨 윗줄 구름·잎이 걸친 띠만. 숲 지붕·열기구 꼭대기가 이 안에
 * 있어 더 키우면 집이 바랜다(숲·열기구 그림에 합성해 보고 고른 값).
 */
const FADE_HEIGHT = '10%';

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
});
