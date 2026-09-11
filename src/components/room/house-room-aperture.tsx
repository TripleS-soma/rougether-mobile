import { useId, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ROOM_ASPECT_RATIO } from '@/components/room/room-render-contract';
import { HouseSceneColors } from '@/constants/theme';
import type { HouseSceneRect } from '@/resources/house-scene';

type Props = { rect?: HouseSceneRect; children: ReactNode; dragging?: boolean };

/** Pixel geometry is scaled together with the opaque scene. Only the aperture clips. */
export function HouseRoomAperture({ rect, children, dragging = false }: Props) {
  const [width, setWidth] = useState(0);
  const id = useId().replace(/:/g, '');
  if (!rect) return <>{children}</>;
  const radius = (rect.radius ?? 0) * (width / rect.width);
  // Uniform center-cover preserves sprite proportions without editing saved coordinates.
  const roomWidth = Math.max(rect.width, rect.height * ROOM_ASPECT_RATIO);
  const roomHeight = roomWidth / ROOM_ASPECT_RATIO;
  return (
    <View
      testID="house-room-aperture"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.aperture, { borderRadius: radius }, dragging && styles.dragging]}>
      <View
        testID="house-room-canvas"
        style={{
          position: 'absolute',
          width: `${(roomWidth / rect.width) * 100}%`,
          height: `${(roomHeight / rect.height) * 100}%`,
          left: `${(1 - roomWidth / rect.width) * 50}%`,
          top: `${(1 - roomHeight / rect.height) * 50}%`,
        }}>
        {children}
      </View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="house-aperture-shade">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`${id}-x`} x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor={HouseSceneColors.edgeInk} stopOpacity="0.18" />
              <Stop offset="0.025" stopColor={HouseSceneColors.edgeInk} stopOpacity="0" />
              <Stop offset="0.975" stopColor={HouseSceneColors.edgeInk} stopOpacity="0" />
              <Stop offset="1" stopColor={HouseSceneColors.edgeInk} stopOpacity="0.12" />
            </LinearGradient>
            <LinearGradient id={`${id}-y`} x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={HouseSceneColors.edgeInk} stopOpacity="0.22" />
              <Stop offset="0.04" stopColor={HouseSceneColors.edgeInk} stopOpacity="0" />
              <Stop offset="0.98" stopColor={HouseSceneColors.edgeInk} stopOpacity="0" />
              <Stop offset="1" stopColor={HouseSceneColors.edgeInk} stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="100" fill={`url(#${id}-x)`} />
          <Rect width="100" height="100" fill={`url(#${id}-y)`} />
        </Svg>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  aperture: { flex: 1, overflow: 'hidden' },
  dragging: { overflow: 'visible' },
});
