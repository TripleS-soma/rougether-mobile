import { useState } from 'react';
import { View } from 'react-native';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { SpeakerPreview } from '@/dev/speaker-preview';
import { toGachaMachine } from '@/api/adapters';
import { STARTER_SPEAKER_KEY } from '@/resources/speaker';
import type { FurnitureItem, PlacedFurniture } from '@/resources/furniture';
const machine = toGachaMachine({
  gachaId: -1,
  code: 'onboarding_starter',
  category: 'FURNITURE',
  name: '첫 가구',
  costCurrencyType: 'COIN',
  costAmount: 0,
  drawCount: 1,
});
const furniture: FurnitureItem[] = [
  {
    id: '700',
    name: '포근한 스피커',
    slot: 'bottomRight',
    category: '가구',
    price: 0,
    assetKey: STARTER_SPEAKER_KEY,
    rarity: '일반',
  },
];
/** Isolated fixture; never calls the draw, wallet, inventory, or room APIs. */
export function StarterSpeakerPreview({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [phase, setPhase] = useState<'draw' | 'decor' | 'room'>('draw');
  const [claimed, setClaimed] = useState(false);
  const [layout, setLayout] = useState<PlacedFurniture[]>([]);
  return (
    <View style={{ flex: 1, minHeight: 760 }}>
      {phase === 'draw' ? (
        <GachaScreen
          gachas={[machine]}
          starterDrawState={claimed ? 'CLAIMED' : 'PENDING'}
          coinBalance={0}
          reducedMotion={reducedMotion}
          onDraw={async () => {
            setClaimed(true);
            return [
              {
                rewardType: 'ITEM',
                itemId: 700,
                name: '포근한 스피커',
                assetKey: STARTER_SPEAKER_KEY,
                rarity: '일반',
                converted: false,
              },
            ];
          }}
          placeableItemIds={['700']}
          onGoPlace={() => setPhase('decor')}
        />
      ) : phase === 'decor' ? (
        <RoomDecorScreen
          furniture={furniture}
          initialItems={layout}
          ownedIds={['700']}
          highlightItemIds={['700']}
          onBack={() => setPhase((current) => (current === 'room' ? 'room' : 'draw'))}
          onApply={async (items) => {
            setLayout(items);
            setPhase('room');
            return 'ok' as const;
          }}
        />
      ) : (
        <SpeakerPreview furniture={furniture} placements={layout} />
      )}
    </View>
  );
}
