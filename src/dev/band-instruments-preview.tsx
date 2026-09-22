import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Room } from '@/components/room/room';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Spacing } from '@/constants/theme';
import { useRoomInstrumentSounds } from '@/hooks/use-room-instrument-sounds';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { INSTRUMENT_SOUNDS } from '@/resources/instrument-sounds';
import type { FurnitureItem, PlacedFurniture } from '@/resources/furniture';

const NAME_KEYS = ['guitar', 'drums', 'bass', 'keyboard'] as const;
const PLACEMENTS: PlacedFurniture[] = [
  { furnitureId: 'band-0', x: 0.17, y: 0.47, z: 0, scale: 1.3 },
  { furnitureId: 'band-1', x: 0.58, y: 0.42, z: 1, scale: 1.55 },
  { furnitureId: 'band-2', x: 0.82, y: 0.72, z: 2, scale: 1.3 },
  { furnitureId: 'band-3', x: 0.32, y: 0.78, z: 3, scale: 1.4 },
];

/** Real Room and playback path; no inventory, wallet, or room API mutations. */
export function BandInstrumentsPreview() {
  const t = useTokens();
  const typography = useTypography();
  const tr = useT();
  const [effects, setEffects] = useState(true);
  const [editing, setEditing] = useState(false);
  const sounds = useRoomInstrumentSounds(effects && !editing);
  const furniture = useMemo<FurnitureItem[]>(
    () =>
      INSTRUMENT_SOUNDS.map((sound, index) => ({
        id: `band-${index}`,
        name: tr(`roomShop.instruments.${NAME_KEYS[index]}`),
        slot: 'bottomLeft',
        category: '가구',
        price: 10,
        assetKey: sound.assetKey,
      })),
    [tr],
  );
  return (
    <View
      style={{
        padding: Spacing.three,
        gap: Spacing.three,
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
      }}>
      <Text style={[typography.h2, { color: t.text }]}>
        {tr('roomShop.instruments.previewTitle')}
      </Text>
      <Text style={[typography.supporting, { color: t.textMuted }]}>
        {tr('roomShop.instruments.previewHint')}
      </Text>
      <Room
        furniture={furniture}
        placements={PLACEMENTS}
        characterId={null}
        editable={editing}
        onInstrumentPress={sounds.play}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.label, { color: t.text }]}>
          {tr('roomShop.instruments.effects')}
        </Text>
        <ToggleSwitch
          value={effects}
          onToggle={() => setEffects((value) => !value)}
          accessibilityLabel={tr('roomShop.instruments.effects')}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.label, { color: t.text }]}>
          {tr('roomShop.instruments.editing')}
        </Text>
        <ToggleSwitch
          value={editing}
          onToggle={() => setEditing((value) => !value)}
          accessibilityLabel={tr('roomShop.instruments.editing')}
        />
      </View>
      {sounds.error ? (
        <Text accessibilityRole="alert" style={[typography.supporting, { color: t.dangerText }]}>
          {sounds.error}
        </Text>
      ) : null}
    </View>
  );
}
