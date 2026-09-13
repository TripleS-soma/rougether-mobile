import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Room } from '@/components/room/room';
import { SpeakerSheet } from '@/components/room/speaker-sheet';
import { useRoomSpeaker } from '@/hooks/use-room-speaker';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { STARTER_SPEAKER_KEY } from '@/resources/speaker';
import { Spacing } from '@/constants/theme';
import type { FurnitureItem } from '@/resources/furniture';
const furniture: FurnitureItem[] = [
  {
    id: 'starter-speaker',
    name: '포근한 스피커',
    slot: 'bottomRight',
    category: '가구',
    price: 0,
    assetKey: STARTER_SPEAKER_KEY,
    rarity: '일반',
  },
];
const placements = [{ furnitureId: 'starter-speaker', x: 0.76, y: 0.72, z: 0, scale: 1 }];
export function SpeakerPreview() {
  const [open, setOpen] = useState(false);
  const speaker = useRoomSpeaker();
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View
      style={{
        gap: Spacing.three,
        padding: Spacing.three,
        backgroundColor: t.surface,
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
      }}>
      <Text style={[Typography.h2, { color: t.text }]}>내 첫 가구, 포근한 스피커</Text>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        스피커를 눌러 방에 소리를 채워 보세요.
      </Text>
      <Room
        furniture={furniture}
        placements={placements}
        onSpeakerPress={() => setOpen(true)}
        speakerPlaying={speaker.playing}
      />
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <Text style={[Typography.label, { color: t.primary }]}>스피커 열기</Text>
      </Pressable>
      <SpeakerSheet
        visible={open}
        onClose={() => setOpen(false)}
        trackId={speaker.trackId}
        volume={speaker.volume}
        playing={speaker.playing}
        loading={speaker.loading}
        error={speaker.error}
        onPlay={speaker.play}
        onStop={speaker.stop}
        onSelectTrack={speaker.selectTrack}
        onVolumeChange={speaker.setVolume}
      />
    </View>
  );
}
