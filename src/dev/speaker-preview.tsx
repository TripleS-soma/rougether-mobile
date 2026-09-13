import { useState } from 'react';
import { View, Text } from 'react-native';
import { Room } from '@/components/room/room';
import { SpeakerSheet } from '@/components/room/speaker-sheet';
import { useRoomSpeaker } from '@/hooks/use-room-speaker';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { STARTER_SPEAKER_KEY } from '@/resources/speaker';
import { Spacing } from '@/constants/theme';
import type { FurnitureItem, PlacedFurniture } from '@/resources/furniture';
const defaultFurniture: FurnitureItem[] = [
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
const defaultPlacements = [{ furnitureId: 'starter-speaker', x: 0.76, y: 0.72, z: 0, scale: 1 }];
export function SpeakerPreview({
  furniture = defaultFurniture,
  placements = defaultPlacements,
}: { furniture?: FurnitureItem[]; placements?: PlacedFurniture[] } = {}) {
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
        한 번 누르면 재생·정지, 길게 누르면 소리 설정.
      </Text>
      <Room
        furniture={furniture}
        placements={placements}
        onSpeakerPress={speaker.playing || speaker.loading ? speaker.stop : speaker.play}
        onSpeakerLongPress={() => setOpen(true)}
        speakerPlaying={speaker.playing}
      />
      {speaker.error ? (
        <Text accessibilityRole="alert" style={[Typography.supporting, { color: t.dangerText }]}>
          {speaker.error}
        </Text>
      ) : null}
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
