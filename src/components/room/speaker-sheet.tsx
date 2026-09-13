import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { SpeakerSprite } from '@/components/room/speaker-sprite';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { clampVolume, SPEAKER_TRACKS, type SpeakerTrackId } from '@/resources/speaker';

export type SpeakerSheetProps = {
  visible: boolean;
  onClose: () => void;
  trackId: SpeakerTrackId;
  volume: number;
  playing: boolean;
  loading: boolean;
  error: string | null;
  onPlay: () => void;
  onStop: () => void;
  onSelectTrack: (id: SpeakerTrackId) => void;
  onVolumeChange: (value: number) => void;
};
export function SpeakerSheet({
  visible,
  onClose,
  trackId,
  volume,
  playing,
  loading,
  error,
  onPlay,
  onStop,
  onSelectTrack,
  onVolumeChange,
}: SpeakerSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const slider = useRef<View>(null);
  const latest = useRef({ onVolumeChange, volume });
  latest.current = { onVolumeChange, volume };
  const bounds = useRef({ x: 0, width: 1 });
  const gesture = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const pageX = event.nativeEvent.pageX;
        slider.current?.measureInWindow((x, _y, width) => {
          bounds.current = { x, width: Math.max(1, width) };
          latest.current.onVolumeChange(clampVolume((pageX - x) / Math.max(1, width)));
        });
      },
      onPanResponderMove: (event) =>
        latest.current.onVolumeChange(
          clampVolume((event.nativeEvent.pageX - bounds.current.x) / bounds.current.width),
        ),
    }),
  ).current;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      dragScope="header"
      cardStyle={{
        maxHeight: '92%',
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        overflow: 'hidden',
        backgroundColor: t.surface,
      }}>
      <ScrollView contentContainerStyle={[styles.content, { backgroundColor: t.surface }]}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[Typography.h2, { color: t.text }]}>방에 흐르는 소리</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              오늘은 어떤 분위기로 쉬어갈까요?
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="스피커 닫기"
            onPress={onClose}
            style={styles.smallButton}>
            <Ionicons name="close" size={Spacing.four} color={t.text} />
          </Pressable>
        </View>
        <View style={styles.hero}>
          <View style={styles.sprite}>
            <SpeakerSprite playing={playing} />
          </View>
        </View>
        <View style={styles.tracks} accessibilityRole="radiogroup">
          {SPEAKER_TRACKS.map((track) => (
            <Pressable
              key={track.id}
              accessibilityRole="radio"
              accessibilityLabel={track.name}
              accessibilityState={{ checked: track.id === trackId }}
              onPress={() => onSelectTrack(track.id)}
              style={[
                styles.track,
                {
                  borderColor: track.id === trackId ? t.primary : t.border,
                  backgroundColor: t.card,
                },
              ]}>
              <View style={styles.flex}>
                <Text style={[Typography.label, { color: t.text }]}>{track.name}</Text>
              </View>
              <Ionicons
                name={track.id === trackId ? 'radio-button-on' : 'radio-button-off'}
                size={Spacing.four}
                color={t.primary}
              />
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <Text style={[Typography.label, { color: t.text }]}>볼륨</Text>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {Math.round(volume * 100)}%
          </Text>
        </View>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="볼륨 줄이기"
            onPress={() => onVolumeChange(clampVolume(volume - 0.1))}
            style={styles.smallButton}>
            <Ionicons name="remove" size={Spacing.four} color={t.text} />
          </Pressable>
          <View
            ref={slider}
            {...gesture.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="스피커 볼륨"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(volume * 100) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) =>
              onVolumeChange(
                clampVolume(volume + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)),
              )
            }
            style={styles.slider}>
            <View pointerEvents="none" style={[styles.rail, { backgroundColor: t.border }]}>
              <View
                style={[styles.fill, { width: `${volume * 100}%`, backgroundColor: t.primary }]}
              />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="볼륨 높이기"
            onPress={() => onVolumeChange(clampVolume(volume + 0.1))}
            style={styles.smallButton}>
            <Text style={[Typography.h3, { color: t.text }]}>+</Text>
          </Pressable>
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={[Typography.supporting, { color: t.text }]}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={playing || loading ? onStop : onPlay}
          style={[styles.play, { backgroundColor: t.primary }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>
            {loading ? '취소' : playing ? '정지' : '재생'}
          </Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  flex: { flex: 1, gap: Spacing.one },
  smallButton: {
    width: Spacing.five + Spacing.three,
    height: Spacing.five + Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { alignItems: 'center', gap: Spacing.two },
  sprite: { width: Spacing.six * 2, height: Spacing.six * 2 },
  tracks: { gap: Spacing.two },
  track: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  slider: { flex: 1, height: Spacing.five + Spacing.three, justifyContent: 'center' },
  rail: { height: Spacing.two, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  play: { alignItems: 'center', padding: Spacing.three, borderRadius: Radius.lg },
});
